import { createOrResetAdmin, primaryAdminEmail, readAdminCredentials, setAdminCookie, signInAdmin, validSetupToken } from "../lib/admin-auth.js";
import { jsonResponse } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const { email, password, setupToken } = await readAdminCredentials(req);
    if (!validSetupToken(setupToken)) return jsonResponse(res, 403, { error: "Invalid admin setup token" });
    const targetEmail = email || primaryAdminEmail();
    await createOrResetAdmin(targetEmail, password);
    const session = await signInAdmin(targetEmail, password);
    setAdminCookie(res, session.access_token, session.expires_in);
    return jsonResponse(res, 200, { ok: true, email: targetEmail });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, error.status === 422 ? 422 : 400, { error: error.message || "Admin setup failed" });
  }
}
