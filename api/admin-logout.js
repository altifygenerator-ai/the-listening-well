import { clearAdminCookie } from "../lib/admin-auth.js";
import { jsonResponse } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  clearAdminCookie(res);
  return jsonResponse(res, 200, { ok: true });
}
