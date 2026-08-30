import crypto from "node:crypto";
import { jsonResponse, readJson, rpc, supabaseRequest, uuidLike } from "../lib/well-core.js";

const ALLOWED_EVENTS = new Set([
  "session_started","composer_viewed","wish_input_started","wish_submitted","goal_selected",
  "wish_clarifier_shown","wish_clarifier_answered","wish_clarifier_skipped","wish_readiness_checked","wish_readiness_skipped",
  "wish_ready","penny_tossed","api_request_completed","api_request_failed","reflection_rendered","reflection_completed","reflection_feedback",
  "audio_play_started","audio_play_paused","audio_play_resumed","audio_play_completed","next_step_committed","next_step_completed","next_step_deferred",
  "free_follow_up_offer_viewed","free_follow_up_offer_clicked","free_follow_up_started","free_follow_up_completed","premium_follow_up_offer_viewed",
  "premium_follow_up_offer_clicked","premium_path_selected","follow_up_direction_selected","follow_up_completed","follow_up_resumed","paid_follow_up_ready",
  "paywall_viewed","penny_wallet_opened","checkout_started","quest_started","quest_step_completed","quest_completed","streak_extended",
  "response_closed","return_to_well_clicked","response_meaning_opened","response_more_opened","coin_choices_toggled","coin_selected",
  "install_prompt_clicked","install_prompt_result","friend_invited","legal_link_clicked"
]);

function safeProperties(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const blocked = /wish|answer|journal|prompt|text|message|content/i;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, item]) => !blocked.test(key) && (item === null || ["string","number","boolean"].includes(typeof item)))
    .slice(0, 16)
    .map(([key, item]) => [String(key).slice(0, 50), typeof item === "string" ? item.slice(0, 160) : item]));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  const body = await readJson(req).catch(() => ({}));
  const sessionId = String(body.sessionId || "");
  if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "Invalid session" });
  const input = Array.isArray(body.events) ? body.events.slice(0, 20) : [];
  const events = input.filter(event => event && ALLOWED_EVENTS.has(String(event.name || ""))).map(event => ({
    event_id: uuidLike(event.id) ? event.id : crypto.randomUUID(),
    session_id: sessionId,
    event_name: String(event.name),
    occurred_at: Number.isFinite(Date.parse(event.at)) ? new Date(event.at).toISOString() : new Date().toISOString(),
    app_version: String(body.clientVersion || "").slice(0, 30) || null,
    properties: safeProperties(event.details)
  }));
  if (!events.length) return jsonResponse(res, 200, { accepted: 0 });
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return jsonResponse(res, 200, { accepted: 0, connected: false });
  }
  try {
    await rpc("touch_well_profile", { p_session_id: sessionId });
    await supabaseRequest("analytics_events?on_conflict=event_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(events)
    });
    return jsonResponse(res, 200, { accepted: events.length, connected: true });
  } catch (error) {
    console.warn("Analytics event storage unavailable:", String(error?.message || error).slice(0, 300));
    // Never make product usage fail because the analytics migration is pending.
    return jsonResponse(res, 200, { accepted: 0, connected: true, storageReady: false });
  }
}
