import { jsonResponse, readJson, rpc, supabaseRequest, uuidLike } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  const { sessionId = "" } = await readJson(req).catch(() => ({}));
  if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "Invalid session" });
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return jsonResponse(res, 200, { connected: false });
  }
  try {
    await rpc("touch_well_profile", { p_session_id: sessionId });
    const [profiles, wishes, monthlyReflections] = await Promise.all([
      supabaseRequest(`well_profiles?session_id=eq.${sessionId}&select=session_id,copper_credits,moon_credits,subscription_active,daily_claim_date,total_wishes,created_at,last_seen`, { method: "GET" }),
      supabaseRequest(`wishes?session_id=eq.${sessionId}&select=*&order=created_at.desc&limit=100`, { method: "GET" }),
      supabaseRequest(`monthly_reflections?session_id=eq.${sessionId}&select=id,month_key,answer,meaning,next_step,share_line,follow_up_question,mood,theme,created_at&order=created_at.desc&limit=36`, { method: "GET" })
    ]);
    return jsonResponse(res, 200, { connected: true, profile: profiles?.[0] || null, wishes: wishes || [], monthlyReflections: monthlyReflections || [] });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: "Could not load the well right now." });
  }
}
