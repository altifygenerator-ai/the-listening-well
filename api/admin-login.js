import { readAdminCredentials, setAdminCookie, signInAdmin } from "../lib/admin-auth.js";
import { jsonResponse } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const { email, password } = await readAdminCredentials(req);
    const session = await signInAdmin(email, password);
    setAdminCookie(res, session.access_token, session.expires_in);
    return jsonResponse(res, 200, { ok: true, email });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 401, { error: "Email or password was not accepted" });
  }
}
