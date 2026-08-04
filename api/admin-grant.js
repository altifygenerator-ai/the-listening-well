import crypto from "node:crypto";
import { requireAdmin } from "../lib/admin-auth.js";
import { jsonResponse, readJson, rpc, uuidLike } from "../lib/well-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  const user = await requireAdmin(req, res);
  if (!user) return;
  try {
    const body = await readJson(req);
    const sessionId = String(body.sessionId || "");
    const coinType = body.coinType === "moon" ? "moon" : "copper";
    const credits = Math.max(1, Math.min(500, Number(body.credits || 0)));
    if (!uuidLike(sessionId) || !Number.isInteger(credits)) return jsonResponse(res, 400, { error: "Invalid test-credit request" });
    const eventId = `admin_${crypto.randomUUID()}`;
    const result = await rpc("grant_well_credits", {
      p_session_id: sessionId,
      p_credits: credits,
      p_coin_type: coinType,
      p_subscription_active: false,
      p_stripe_customer_id: null,
      p_stripe_event_id: eventId,
      p_pack: "admin_test",
      p_source: `admin:${user.email}`
    });
    return jsonResponse(res, 200, { ok: true, result, coinType, credits });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: "Test pennies could not be granted" });
  }
}
