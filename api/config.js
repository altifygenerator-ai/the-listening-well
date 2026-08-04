import { jsonResponse } from "../lib/well-core.js";
import { primaryAdminEmail } from "../lib/admin-auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return jsonResponse(res, 405, { error: "Method not allowed" });
  const database = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  const stripePrices = Boolean(
    process.env.STRIPE_PRICE_COPPER_10 &&
    process.env.STRIPE_PRICE_MOON_30 &&
    process.env.STRIPE_PRICE_KEEPER_MONTHLY
  );
  return jsonResponse(res, 200, {
    ai: Boolean(process.env.OPENAI_API_KEY),
    database,
    payments: Boolean(database && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && stripePrices),
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    admin: Boolean(database && process.env.ADMIN_SETUP_TOKEN),
    adminEmail: primaryAdminEmail(),
    appName: "The Listening Well"
  });
}
