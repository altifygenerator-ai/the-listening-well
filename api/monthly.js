import { generateOpenAIWish, jsonResponse, localWishResponse, readJson, rpc, sanitizeWish, supabaseRequest, uuidLike } from "../lib/well-core.js";

function reflectionFromRow(row) {
  return {
    answer: row.answer,
    meaning: row.meaning,
    nextStep: row.next_step,
    shareLine: row.share_line,
    followUpQuestion: row.follow_up_question,
    mood: row.mood,
    theme: row.theme || "uncertainty",
    source: "cloud",
    reflectionId: row.id,
    createdAt: row.created_at,
    monthKey: row.month_key,
    existing: true
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req, 40_000);
    if (!uuidLike(body.sessionId)) return jsonResponse(res, 400, { error: "Invalid session" });
    const lines = Array.isArray(body.wishes) ? body.wishes.map(sanitizeWish).filter(Boolean).slice(-12) : [];
    if (lines.length < 3) return jsonResponse(res, 400, { error: "The well needs at least three saved wishes to hear a pattern." });

    const month = new Date().toISOString().slice(0, 7);
    const databaseConnected = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
    if (databaseConnected) {
      await rpc("touch_well_profile", { p_session_id: body.sessionId });
      const existing = await supabaseRequest(`monthly_reflections?session_id=eq.${body.sessionId}&month_key=eq.${month}&select=*&limit=1`, { method: "GET" });
      if (existing?.[0]) return jsonResponse(res, 200, reflectionFromRow(existing[0]));
    }

    const summaryWish = `Create a monthly reflection from these private wishes. Do not repeat or expose them verbatim. Notice the clearest recurring need and suggest one grounded focus for the next month:\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}`;
    const response = process.env.OPENAI_API_KEY
      ? await generateOpenAIWish({ wish: summaryWish, priorThemes: [], apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-5" })
      : localWishResponse(summaryWish);

    if (databaseConnected) {
      const rows = await supabaseRequest("monthly_reflections", {
        method: "POST",
        body: JSON.stringify({
          session_id: body.sessionId,
          month_key: month,
          answer: response.answer,
          meaning: response.meaning,
          next_step: response.nextStep,
          share_line: response.shareLine,
          follow_up_question: response.followUpQuestion,
          mood: response.mood,
          theme: response.theme || "uncertainty"
        })
      });
      const row = rows?.[0];
      if (row) {
        return jsonResponse(res, 200, {
          ...response,
          reflectionId: row.id,
          createdAt: row.created_at,
          monthKey: row.month_key
        });
      }
    }

    return jsonResponse(res, 200, { ...response, monthKey: month });
  } catch (error) {
    console.error(error);
    if (String(error.message).includes("duplicate key")) {
      return jsonResponse(res, 409, { error: "This month’s echo has already been gathered." });
    }
    return jsonResponse(res, 500, { error: "The month's echo could not be gathered." });
  }
}
