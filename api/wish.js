import {
  crisisResponse,
  detectLocalSafety,
  generateOpenAIWish,
  harmfulResponse,
  jsonResponse,
  localWishResponse,
  moderateWish,
  readJson,
  rpc,
  sanitizeWish,
  supabaseRequest,
  uuidLike
} from "../lib/well-core.js";

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
  if (!uuidLike(parentCloudId)) return { allowed: false, reason: "missing_parent" };
  const parentRows = await supabaseRequest(
    `wishes?id=eq.${parentCloudId}&session_id=eq.${sessionId}&select=id&limit=1`,
    { method: "GET" }
  );
  if (!Array.isArray(parentRows) || !parentRows.length) return { allowed: false, reason: "parent_not_found" };
  const usedRows = await supabaseRequest(
    `wishes?session_id=eq.${sessionId}&parent_wish_id=eq.${parentCloudId}&response_kind=eq.follow_up&coin_source=eq.local&select=id&limit=1`,
    { method: "GET" }
  );
  return { allowed: !Array.isArray(usedRows) || usedRows.length === 0, reason: "already_used" };
}

async function persistWish({ sessionId, wish, response, coinSource, followUp = null }) {
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
    const legacySchema = followUp && /response_kind|parent_wish_id|follow_up_prompt|follow_up_direction|schema cache/i.test(String(error.message));
    if (!legacySchema) throw error;
    const rows = await supabaseRequest("wishes", { method: "POST", body: JSON.stringify(baseRow) });
    return rows?.[0]?.id || null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });

  let refundableCoin = null;
  let refundableSessionId = null;
  try {
    const body = await readJson(req);
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
    const followUp = body.followUp && typeof body.followUp === "object" ? {
      parentCloudId: uuidLike(body.followUp.parentCloudId) ? body.followUp.parentCloudId : null,
      originalAnswer: sanitizeWish(body.followUp.originalAnswer).slice(0, 900),
      originalMeaning: sanitizeWish(body.followUp.originalMeaning).slice(0, 700),
      question: sanitizeWish(body.followUp.question).slice(0, 320),
      direction: ["clarity", "action", "release", "custom"].includes(body.followUp.direction) ? body.followUp.direction : "custom"
    } : null;

    if (!wish || wish.length < 3) return jsonResponse(res, 400, { error: "Please give the well a little more to listen to." });
    if (followUp && followUp.question.length < 4) return jsonResponse(res, 400, { error: "Ask the well one clear follow-up question." });
    if (followUp && coinIntent === "daily") return jsonResponse(res, 400, { error: "Follow-up echoes use the free clarification, a Copper penny, or a Moon penny." });
    if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "Invalid session" });
    if (!rateAllowed(req, sessionId)) {
      res.setHeader("Retry-After", "3600");
      return jsonResponse(res, 429, { error: "The well needs a little quiet before hearing more wishes." });
    }

    let response = null;
    const moderationInput = followUp ? `${wish}
Follow-up: ${followUp.question}` : wish;
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

    if (!response && !process.env.OPENAI_API_KEY && process.env.VERCEL) {
      return jsonResponse(res, 503, {
        error: "The well is temporarily quiet. Your penny was not used.",
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
            ? "This wish has already used its free follow-up."
            : "The original wish could not be verified for a free follow-up.",
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
        response = process.env.OPENAI_API_KEY
          ? await generateOpenAIWish({
              wish,
              priorThemes,
              priorContext,
              followUp,
              apiKey: process.env.OPENAI_API_KEY,
              model: process.env.OPENAI_MODEL || "gpt-5",
              depth,
              safetyIdentifier: sessionId
            })
          : localWishResponse(wish, { depth });
      } catch (error) {
        console.error("AI response unavailable:", error);
        if (process.env.OPENAI_API_KEY) throw error;
        response = localWishResponse(wish, { depth });
      }
    }

    let wishId = null;
    if (!response.safety) wishId = await persistWish({ sessionId, wish, response, coinSource, followUp });
    refundableCoin = null;

    return jsonResponse(res, 200, {
      ...response,
      coinSource: freeFollowUp ? "free" : coinSource,
      wishId,
      responseKind: followUp ? "follow_up" : "wish",
      followUpTier: freeFollowUp ? "free" : followUp ? "paid" : null
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
    return jsonResponse(res, 500, { error: "The well went quiet for a moment. Your penny was restored." });
  }
}
