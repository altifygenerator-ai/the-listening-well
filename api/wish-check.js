import {
  assessWishReadiness,
  detectLocalSafety,
  jsonResponse,
  readJson,
  sanitizeWish,
  uuidLike
} from "../lib/well-core.js";

const buckets = globalThis.__wellWishCheckBuckets || new Map();
globalThis.__wellWishCheckBuckets = buckets;

function allowed(req, sessionId) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  const key = `${ip}:${sessionId}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const history = (buckets.get(key) || []).filter(value => now - value < windowMs);
  if (history.length >= 40) {
    buckets.set(key, history);
    return false;
  }
  history.push(now);
  buckets.set(key, history);
  return true;
}

function localReadiness(wish) {
  const text = String(wish || "").replace(/\s+/g, " ").trim();
  const words = text.replace(/[’']/g, "").split(/\s+/).filter(Boolean);
  const clearlyGeneric = /^(?:i\s+)?wish(?:\s+(?:i|we)\s+(?:was|were|had|could\s+be|could\s+have))?\s*(?:for\s+)?(?:happ(?:y|iness)|love|money|success|peace|health|luck|a\s+better\s+life|things\s+were\s+better)[.!?]*$/i.test(text);
  if (words.length <= 3 || clearlyGeneric) {
    return {
      ready: false,
      question: "What would actually be different in your life if this wish came true?",
      reason: "missing_context"
    };
  }
  return { ready: true, question: "", reason: "specific_enough" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const wish = sanitizeWish(body.wish).slice(0, 700);
    const sessionId = String(body.sessionId || "");
    if (!wish || wish.length < 3) return jsonResponse(res, 400, { error: "Give the well a little more to listen to." });
    if (detectLocalSafety(wish)) return jsonResponse(res, 200, { ready: true, question: "", reason: "specific_enough" });
    if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "Invalid session" });
    if (!allowed(req, sessionId)) return jsonResponse(res, 429, { ready: true, question: "", reason: "specific_enough" });

    if (!process.env.OPENAI_API_KEY) return jsonResponse(res, 200, localReadiness(wish));

    try {
      const result = await assessWishReadiness({
        wish,
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_QUALITY_MODEL || process.env.OPENAI_MODEL || "gpt-5",
        safetyIdentifier: sessionId
      });
      return jsonResponse(res, 200, result);
    } catch (error) {
      console.error("Wish readiness check unavailable:", error);
      return jsonResponse(res, 200, localReadiness(wish));
    }
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 400, { error: "The well could not read that wish yet." });
  }
}
