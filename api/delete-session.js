import { jsonResponse, readJson, supabaseRequest, uuidLike } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (!["POST", "DELETE"].includes(req.method)) return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJson(req);
    const sessionId = String(body.sessionId || "");
    if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "Invalid session" });
    if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      return jsonResponse(res, 200, { connected: false, deleted: true });
    }
    await supabaseRequest(`well_profiles?session_id=eq.${sessionId}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
    return jsonResponse(res, 200, { connected: true, deleted: true });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: "The cloud journal could not be cleared." });
  }
}
