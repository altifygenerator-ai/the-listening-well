import { inferOrigin, jsonResponse, readJson, uuidLike } from "../lib/well-core.js";
import { expectedPriceId, getPack } from "../lib/commerce.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const { pack: packKey, sessionId } = await readJson(req);
    const selection = getPack(packKey);
    if (!selection || !uuidLike(sessionId)) return jsonResponse(res, 400, { error: "Invalid purchase" });

    const databaseReady = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
    const secret = process.env.STRIPE_SECRET_KEY;
    const price = expectedPriceId(selection);
    if (!databaseReady) return jsonResponse(res, 503, {
      error: "Connect Supabase before accepting payments so purchased pennies can be delivered safely.",
      code: "DATABASE_NOT_CONFIGURED"
    });
    if (!secret || !price) return jsonResponse(res, 503, {
      error: "Payments are ready for keys but are not connected yet.",
      code: "PAYMENTS_NOT_CONFIGURED"
    });

    const origin = inferOrigin(req);
    const form = new URLSearchParams();
    form.set("mode", selection.mode);
    form.set("line_items[0][price]", price);
    form.set("line_items[0][quantity]", "1");
    form.set("success_url", `${origin}/?payment=success&pack=${encodeURIComponent(selection.key)}&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${origin}/?payment=cancelled`);
    form.set("client_reference_id", sessionId);
    form.set("metadata[session_id]", sessionId);
    form.set("metadata[pack]", selection.key);
    form.set("metadata[coin_type]", selection.coinType);
    form.set("metadata[credits]", String(selection.credits));
    form.set("allow_promotion_codes", "true");
    if (selection.mode === "subscription") {
      form.set("subscription_data[metadata][session_id]", sessionId);
      form.set("subscription_data[metadata][pack]", selection.key);
      form.set("subscription_data[metadata][coin_type]", selection.coinType);
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form
    });
    const data = await stripeResponse.json();
    if (!stripeResponse.ok) throw new Error(data?.error?.message || "Stripe checkout failed");
    return jsonResponse(res, 200, { url: data.url });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: "Checkout could not be opened." });
  }
}
