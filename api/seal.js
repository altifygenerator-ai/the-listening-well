import { jsonResponse, readJson, supabaseRequest, uuidLike } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const { sessionId, wishId, sealedUntil } = await readJson(req);
    if (!uuidLike(sessionId) || !wishId || !sealedUntil) return jsonResponse(res, 400, { error: "Invalid request" });
    if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return jsonResponse(res, 200, { connected: false });
    const result = await supabaseRequest(`wishes?id=eq.${encodeURIComponent(wishId)}&session_id=eq.${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ sealed_until: sealedUntil })
    });
    return jsonResponse(res, 200, { connected: true, wish: result?.[0] || null });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: "The wish could not be sealed." });
  }
}
