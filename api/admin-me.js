import { getAdminUser, primaryAdminEmail } from "../lib/admin-auth.js";
import { jsonResponse } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return jsonResponse(res, 405, { error: "Method not allowed" });
  const user = await getAdminUser(req);
  return jsonResponse(res, 200, {
    authenticated: Boolean(user),
    email: user?.email || primaryAdminEmail(),
    setupAvailable: Boolean(process.env.ADMIN_SETUP_TOKEN),
    database: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
  });
}
