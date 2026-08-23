import { expectedPriceId, getPack } from "../lib/commerce.js";
import { jsonResponse, readJson, rpc, supabaseRequest, uuidLike } from "../lib/well-core.js";

async function stripeRequest(path, options = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Stripe request failed");
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  try {
    const { sessionId = "" } = await readJson(req);
    if (!uuidLike(sessionId)) return jsonResponse(res, 400, { error: "The well could not find this subscription." });
    if (!process.env.STRIPE_SECRET_KEY || !process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      return jsonResponse(res, 503, { error: "Well Keeper cannot be changed right now. Please try again later." });
    }

    const profiles = await supabaseRequest(
      `well_profiles?session_id=eq.${sessionId}&select=stripe_customer_id,subscription_active&limit=1`,
      { method: "GET" }
    );
    const customerId = String(profiles?.[0]?.stripe_customer_id || "");
    if (!customerId) return jsonResponse(res, 404, { error: "No Well Keeper subscription was found for this browser." });

    const keeper = getPack("keeper_monthly");
    const keeperPriceId = expectedPriceId(keeper);
    if (!keeperPriceId) return jsonResponse(res, 503, { error: "Well Keeper cannot be changed right now. Please try again later." });

    const query = new URLSearchParams({ customer: customerId, status: "all", limit: "20" });
    const subscriptions = await stripeRequest(`subscriptions?${query}`);
    const subscription = (subscriptions?.data || []).find(item =>
      ["active", "trialing", "past_due", "unpaid"].includes(String(item?.status || ""))
      && item?.items?.data?.some(entry => String(entry?.price?.id || "") === keeperPriceId)
    );
    if (!subscription) {
      await rpc("set_well_subscription", {
        p_session_id: sessionId,
        p_active: false,
        p_stripe_customer_id: customerId
      });
      return jsonResponse(res, 200, { cancelled: true, alreadyEnded: true, endsAt: null });
    }

    if (!subscription.cancel_at_period_end) {
      const form = new URLSearchParams({ cancel_at_period_end: "true" });
      const updated = await stripeRequest(`subscriptions/${encodeURIComponent(subscription.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form
      });
      subscription.cancel_at_period_end = Boolean(updated.cancel_at_period_end);
      subscription.cancel_at = updated.cancel_at || subscription.cancel_at;
      subscription.current_period_end = updated.current_period_end || subscription.current_period_end;
    }

    await rpc("set_well_subscription", {
      p_session_id: sessionId,
      p_active: false,
      p_stripe_customer_id: customerId
    });

    const unixEnd = Number(subscription.cancel_at || subscription.current_period_end || 0);
    return jsonResponse(res, 200, {
      cancelled: true,
      endsAt: unixEnd > 0 ? new Date(unixEnd * 1000).toISOString() : null
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: "Well Keeper could not be canceled. Please try again later." });
  }
}
