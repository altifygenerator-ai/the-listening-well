import {
  crisisResponse,
  detectLocalSafety,
  generateOpenAIWish,
  harmfulResponse,
  jsonResponse,
  moderateWish,
  readJson,
  rpc,
  sanitizeWish,
  supabaseRequest,
  uuidLike
} from "../lib/well-core.js";

const RESPONSE_VERSION = "1.7.4";

const rateBuckets = globalThis.__listeningWellRateBuckets || new Map();
globalThis.__listeningWellRateBuckets = rateBuckets;

function rateAllowed(req, sessionId) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  const key = `${ip}:${sessionId}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const bucket = (rateBuckets.get(key) || []).filter(timestamp => now - timestamp < windowMs);
  if (bucket.length >= 30) {
    rateBuckets.set(key, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 2500) {
    for (const [candidate, timestamps] of rateBuckets) {
      if (!timestamps.some(timestamp => now - timestamp < windowMs)) rateBuckets.delete(candidate);
    }
  }
  return true;
}

function isSelfHarm(categories = {}) {
  return Boolean(categories["self-harm"] || categories["self-harm/intent"] || categories["self-harm/instructions"]);
}

function isViolence(categories = {}) {
  return Boolean(categories.violence || categories["violence/graphic"] || categories["illicit/violent"]);
}

function normalizeCoinIntent(value) {
  return ["daily", "copper", "moon", "free"].includes(value) ? value : "daily";
}

function responseDepth(coinSource) {
  if (coinSource === "moon") return "moon";
  if (coinSource === "copper") return "deep";
  if (coinSource === "free") return "clarify";
  return "standard";
}

async function freeFollowUpAvailable({ sessionId, parentCloudId }) {
  // Prefer strict cloud verification, but do not break an existing browser if it
  // still has wishes from an older schema/version. The client also enforces the
  // one-free-follow-up rule for normal users.
  if (uuidLike(parentCloudId)) {
    try {
      const parentRows = await supabaseRequest(
        `wishes?id=eq.${parentCloudId}&session_id=eq.${sessionId}&select=id&limit=1`,
        { method: "GET" }
      );
      if (Array.isArray(parentRows) && !parentRows.length) return { allowed: false, reason: "parent_not_found" };
    } catch (error) {
      console.warn("Free follow-up parent verification skipped:", error.message);
    }
  }

  try {
    const usedRows = await supabaseRequest(
      `wishes?session_id=eq.${sessionId}&response_kind=eq.follow_up&coin_source=eq.local&select=id&limit=1`,
      { method: "GET" }
    );
    return { allowed: !Array.isArray(usedRows) || usedRows.length === 0, reason: "already_used" };
  } catch (error) {
    // Older databases may not have response_kind yet. A free follow-up has always
    // been stored with coin_source=local, so that remains a safe compatibility check.
    try {
      const legacyUsedRows = await supabaseRequest(
        `wishes?session_id=eq.${sessionId}&coin_source=eq.local&select=id&limit=1`,
        { method: "GET" }
      );
      return { allowed: !Array.isArray(legacyUsedRows) || legacyUsedRows.length === 0, reason: "already_used" };
    } catch (legacyError) {
      console.warn("Free follow-up compatibility check unavailable:", legacyError.message);
      return { allowed: true, reason: "compatibility_mode" };
    }
  }
}

async function persistWish({ sessionId, wish, clarification = "", response, coinSource, followUp = null }) {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return null;
  await rpc("touch_well_profile", { p_session_id: sessionId });
  const baseRow = {
    session_id: sessionId,
    wish_text: wish,
    answer: response.answer,
    meaning: response.meaning,
    next_step: response.nextStep,
    share_line: response.shareLine,
    follow_up_question: response.followUpQuestion,
    clarification_text: clarification || null,
    moon_note: response.moonNote || null,
    mood: response.mood,
    theme: response.theme || "uncertainty",
    coin_source: coinSource || "local",
    safety: response.safety || null
  };
  const extendedRow = followUp ? {
    ...baseRow,
    response_kind: "follow_up",
    parent_wish_id: uuidLike(followUp.parentCloudId) ? followUp.parentCloudId : null,
    follow_up_prompt: followUp.question,
    follow_up_direction: followUp.direction
  } : baseRow;
  try {
    const rows = await supabaseRequest("wishes", { method: "POST", body: JSON.stringify(extendedRow) });
    return rows?.[0]?.id || null;
  } catch (error) {
    const message = String(error.message || "");
    if (!/response_kind|parent_wish_id|follow_up_prompt|follow_up_direction|clarification_text|moon_note|schema cache/i.test(message)) throw error;

    const { clarification_text, moon_note, ...withoutPersonalFields } = extendedRow;
    try {
      const rows = await supabaseRequest("wishes", { method: "POST", body: JSON.stringify(withoutPersonalFields) });
      return rows?.[0]?.id || null;
    } catch (secondError) {
      if (!followUp || !/response_kind|parent_wish_id|follow_up_prompt|follow_up_direction|schema cache/i.test(String(secondError.message || ""))) throw secondError;
      const { clarification_text: _clarification, moon_note: _moon, ...legacyBaseRow } = baseRow;
      const rows = await supabaseRequest("wishes", { method: "POST", body: JSON.stringify(legacyBaseRow) });
      return rows?.[0]?.id || null;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });

  let refundableCoin = null;
  let refundableSessionId = null;
  try {
    const body = await readJson(req);
    if (String(body.clientVersion || "") !== RESPONSE_VERSION) {
      return jsonResponse(res, 409, {
        error: "A newer version of the well is ready. Refresh the page once and try again.",
        code: "APP_UPDATE_REQUIRED",
        responseVersion: RESPONSE_VERSION
      });
    }
    const wish = sanitizeWish(body.wish);
    const sessionId = String(body.sessionId || "");
    const priorThemes = Array.isArray(body.priorThemes) ? body.priorThemes.map(String).slice(-5) : [];
    const priorContext = Array.isArray(body.priorContext)
      ? body.priorContext.slice(-3).map(item => ({
          theme: String(item?.theme || "uncertainty").slice(0, 40),
          wish: sanitizeWish(item?.wish).slice(0, 220)
        })).filter(item => item.wish)
      : [];
    const coinIntent = normalizeCoinIntent(body.coinIntent);
    const clarification = sanitizeWish(body.clarification).slice(0, 500);
    const followUp = body.followUp && typeof body.followUp === "object" ? {
      parentCloudId: uuidLike(body.followUp.parentCloudId) ? body.followUp.parentCloudId : null,
      originalAnswer: sanitizeWish(body.followUp.originalAnswer).slice(0, 900),
      originalMeaning: sanitizeWish(body.followUp.originalMeaning).slice(0, 700),
      originalClarification: sanitizeWish(body.followUp.originalClarification).slice(0, 500),
      question: sanitizeWish(body.followUp.question).slice(0, 320),
      direction: ["clarity", "action", "release", "custom"].includes(body.followUp.direction) ? body.followUp.direction : "custom"
    } : null;

    if (!wish || wish.length < 3) return jsonResponse(res, 400, { error: "Please give the well a little more to listen to." });
    if (followUp && followUp.question.length < 4) return jsonResponse(res, 400, { error: "Ask the well one clear follow-up question." });
    if (followUp && coinIntent === "daily") return jsonResponse(res, 400, { error: "Follow-up echoes use the free clarification, a Copper penny, or a Moon penny." });
    if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "The well lost its place. Refresh the page and try again.", code: "SESSION_RESET_NEEDED" });
    if (!rateAllowed(req, sessionId)) {
      res.setHeader("Retry-After", "3600");
      return jsonResponse(res, 429, { error: "The well needs a little quiet before hearing more wishes." });
    }

    let response = null;
    const moderationInput = followUp ? `${wish}
Follow-up: ${followUp.question}` : `${wish}${clarification ? `
Additional detail: ${clarification}` : ""}`;
    const localSafety = detectLocalSafety(moderationInput);
    if (localSafety === "crisis") response = crisisResponse();
    if (localSafety === "harm") response = harmfulResponse();

    if (!response && process.env.OPENAI_API_KEY) {
      try {
        const moderation = await moderateWish(moderationInput, process.env.OPENAI_API_KEY);
        if (isSelfHarm(moderation.categories)) response = crisisResponse();
        if (isViolence(moderation.categories)) response = harmfulResponse();
      } catch (error) {
        console.error("Moderation unavailable:", error);
      }
    }

    if (!response && !process.env.OPENAI_API_KEY) {
      return jsonResponse(res, 503, {
        error: "The well could not answer just now. Your penny was not used. Please try again in a moment.",
        code: "AI_UNAVAILABLE"
      });
    }

    let coinSource = response?.safety ? "safety" : "local";
    const databaseReady = process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
    const freeFollowUp = Boolean(followUp && coinIntent === "free");

    if (!response?.safety && freeFollowUp && databaseReady) {
      const availability = await freeFollowUpAvailable({ sessionId, parentCloudId: followUp.parentCloudId });
      if (!availability.allowed) {
        return jsonResponse(res, 409, {
          error: availability.reason === "already_used"
            ? "Your free follow-up has already been used."
            : "This saved wish cannot use the free follow-up. Copper or Moon can keep it going.",
          code: availability.reason === "already_used" ? "FREE_FOLLOW_UP_USED" : "FREE_FOLLOW_UP_UNAVAILABLE"
        });
      }
      coinSource = "local";
    } else if (!response?.safety && databaseReady) {
      const consumed = await rpc("consume_well_coin", {
        p_session_id: sessionId,
        p_coin_intent: coinIntent
      });
      const result = Array.isArray(consumed) ? consumed[0] : consumed;
      if (!result?.allowed) return jsonResponse(res, 402, {
        error: result?.reason === "daily_used" ? "Today’s free penny has already been used." : `You do not have a ${coinIntent} penny ready.`,
        code: "NO_COIN",
        reason: result?.reason || "no_coin"
      });
      coinSource = result.source || coinIntent;
      refundableCoin = coinSource;
      refundableSessionId = sessionId;
    } else if (!response?.safety) {
      coinSource = freeFollowUp ? "free" : coinIntent;
    }

    if (!response) {
      const depth = freeFollowUp ? "clarify" : responseDepth(coinSource);
      try {
        response = await generateOpenAIWish({
          wish,
          priorThemes,
          priorContext,
          followUp,
          clarification,
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || "gpt-5",
          depth,
          safetyIdentifier: sessionId
        });
      } catch (error) {
        console.error("AI response unavailable:", error);
        throw error;
      }
    }

    let wishId = null;
    if (!response.safety) wishId = await persistWish({ sessionId, wish, clarification, response, coinSource, followUp });
    refundableCoin = null;

    return jsonResponse(res, 200, {
      ...response,
      coinSource: freeFollowUp ? "free" : coinSource,
      wishId,
      responseKind: followUp ? "follow_up" : "wish",
      followUpTier: freeFollowUp ? "free" : followUp ? "paid" : null,
      responseVersion: RESPONSE_VERSION
    });
  } catch (error) {
    console.error(error);
    if (refundableCoin && refundableSessionId) {
      try {
        await rpc("restore_well_coin", {
          p_session_id: refundableSessionId,
          p_coin_source: refundableCoin
        });
      } catch (restoreError) {
        console.error("Could not automatically restore the consumed penny:", restoreError);
      }
    }
    return jsonResponse(res, 500, {
      error: refundableCoin
        ? "The well went quiet before it could answer. Your penny was returned. Try again in a moment."
        : "The well went quiet before it could answer. No penny was used. Try again in a moment."
    });
  }
}
