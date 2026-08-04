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
  return ["daily", "copper", "moon"].includes(value) ? value : "daily";
}

function responseDepth(coinSource) {
  if (coinSource === "moon") return "moon";
  if (coinSource === "copper") return "deep";
  return "standard";
}

async function persistWish({ sessionId, wish, response, coinSource }) {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return null;
  await rpc("touch_well_profile", { p_session_id: sessionId });
  const rows = await supabaseRequest("wishes", {
    method: "POST",
    body: JSON.stringify({
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
    })
  });
  return rows?.[0]?.id || null;
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
    const coinIntent = normalizeCoinIntent(body.coinIntent);

    if (!wish || wish.length < 3) return jsonResponse(res, 400, { error: "Please give the well a little more to listen to." });
    if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "Invalid session" });
    if (!rateAllowed(req, sessionId)) {
      res.setHeader("Retry-After", "3600");
      return jsonResponse(res, 429, { error: "The well needs a little quiet before hearing more wishes." });
    }

    let response = null;
    const localSafety = detectLocalSafety(wish);
    if (localSafety === "crisis") response = crisisResponse();
    if (localSafety === "harm") response = harmfulResponse();

    if (!response && process.env.OPENAI_API_KEY) {
      try {
        const moderation = await moderateWish(wish, process.env.OPENAI_API_KEY);
        if (isSelfHarm(moderation.categories)) response = crisisResponse();
        if (isViolence(moderation.categories)) response = harmfulResponse();
      } catch (error) {
        console.error("Moderation unavailable:", error);
      }
    }

    let coinSource = response?.safety ? "safety" : "local";
    const databaseReady = process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!response?.safety && databaseReady) {
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
      coinSource = coinIntent;
    }

    if (!response) {
      const depth = responseDepth(coinSource);
      try {
        response = process.env.OPENAI_API_KEY
          ? await generateOpenAIWish({
              wish,
              priorThemes,
              apiKey: process.env.OPENAI_API_KEY,
              model: process.env.OPENAI_MODEL || "gpt-5",
              depth,
              safetyIdentifier: sessionId
            })
          : localWishResponse(wish, { depth });
      } catch (error) {
        console.error("AI fallback:", error);
        response = localWishResponse(wish, { depth });
      }
    }

    let wishId = null;
    if (!response.safety) wishId = await persistWish({ sessionId, wish, response, coinSource });
    refundableCoin = null;

    return jsonResponse(res, 200, { ...response, coinSource, wishId });
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
