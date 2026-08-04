import crypto from "node:crypto";
import { jsonResponse, rpc, uuidLike } from "../lib/well-core.js";
import { expectedPriceId, getPack } from "../lib/commerce.js";

export const config = { api: { bodyParser: false } };

async function readRaw(req, limit = 1_000_000) {
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > limit) throw new Error("Request too large");
    return req.body;
  }
  if (typeof req.body === "string") {
    const raw = Buffer.from(req.body, "utf8");
    if (raw.length > limit) throw new Error("Request too large");
    return raw;
  }
  if (req.body && typeof req.body === "object") {
    throw new Error("Stripe webhook body was parsed before signature verification");
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function verifyStripeSignature(raw, signature, secret) {
  const entries = String(signature || "").split(",").map(part => part.split("=", 2));
  const timestamp = entries.find(([key]) => key === "t")?.[1];
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw.toString("utf8")}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some(signatureValue => {
    try {
      const provided = Buffer.from(signatureValue, "hex");
      return expectedBuffer.length === provided.length && crypto.timingSafeEqual(expectedBuffer, provided);
    } catch {
      return false;
    }
  });
}

async function stripeGet(path) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe secret key is missing");
  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `Stripe lookup failed: ${response.status}`);
  return data;
}

async function recordWebhook(event, status, detail = null) {
  if (!event?.id) return;
  try {
    await rpc("record_well_webhook_event", {
      p_stripe_event_id: String(event.id),
      p_event_type: String(event.type || "unknown"),
      p_status: status,
      p_detail: detail ? String(detail).slice(0, 500) : null
    });
  } catch (error) {
    console.warn("Could not record webhook audit row:", error.message);
  }
}

async function checkoutPriceId(checkoutSessionId) {
  const lineItems = await stripeGet(`checkout/sessions/${encodeURIComponent(checkoutSessionId)}/line_items?limit=10`);
  return String(lineItems?.data?.[0]?.price?.id || "");
}

async function validatePackPrice(pack, actualPriceId) {
  const expected = expectedPriceId(pack);
  if (!pack || !expected || !actualPriceId || actualPriceId !== expected) {
    throw new Error(`Stripe price mismatch for ${pack?.key || "unknown pack"}`);
  }
}

async function grantPack({ pack, sessionId, customerId, eventId, subscriptionActive = false }) {
  if (!pack || !uuidLike(sessionId)) throw new Error("Stripe event is missing a valid Listening Well session");
  return rpc("grant_well_credits", {
    p_session_id: sessionId,
    p_credits: pack.credits,
    p_coin_type: pack.coinType,
    p_subscription_active: subscriptionActive,
    p_stripe_customer_id: customerId || null,
    p_stripe_event_id: eventId,
    p_pack: pack.key,
    p_source: subscriptionActive ? "subscription" : "stripe"
  });
}

async function checkoutContext(object) {
  const pack = getPack(object?.metadata?.pack);
  if (!pack) throw new Error("Unknown Stripe pack metadata");
  const sessionId = object?.metadata?.session_id || object?.client_reference_id;
  const priceId = await checkoutPriceId(object.id);
  await validatePackPrice(pack, priceId);
  return {
    pack,
    sessionId,
    customerId: String(object?.customer || "")
  };
}

async function subscriptionContext(object) {
  const subscriptionId = typeof object?.subscription === "string"
    ? object.subscription
    : object?.parent?.subscription_details?.subscription;
  const subscription = subscriptionId
    ? await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`)
    : object;
  const metadata = subscription?.metadata || object?.parent?.subscription_details?.metadata || object?.metadata || {};
  const pack = getPack(metadata.pack || "keeper_monthly");
  if (!pack || pack.mode !== "subscription") throw new Error("Unknown subscription pack metadata");
  const priceId = String(subscription?.items?.data?.[0]?.price?.id || "");
  await validatePackPrice(pack, priceId);
  return {
    pack,
    sessionId: metadata.session_id,
    customerId: String(subscription?.customer || object?.customer || ""),
    status: String(subscription?.status || object?.status || "")
  };
}

async function processEvent(event) {
  const object = event.data?.object || {};

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (object.payment_status === "unpaid") return { status: "ignored", detail: "Checkout is not paid yet" };
    const context = await checkoutContext(object);
    await grantPack({
      ...context,
      eventId: String(event.id),
      subscriptionActive: context.pack.mode === "subscription"
    });
    return { status: "processed", detail: `${context.pack.credits} ${context.pack.coinType} credits granted` };
  }

  if (event.type === "invoice.paid") {
    if (object.billing_reason === "subscription_create") {
      return { status: "ignored", detail: "Initial subscription credits are granted by checkout.session.completed" };
    }
    const context = await subscriptionContext(object);
    await grantPack({ ...context, eventId: String(event.id), subscriptionActive: true });
    return { status: "processed", detail: `${context.pack.credits} monthly moon credits granted` };
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const context = await subscriptionContext(object);
    if (!uuidLike(context.sessionId)) throw new Error("Subscription metadata is missing session_id");
    const active = event.type !== "customer.subscription.deleted" && ["active", "trialing"].includes(context.status);
    await rpc("set_well_subscription", {
      p_session_id: context.sessionId,
      p_active: active,
      p_stripe_customer_id: context.customerId
    });
    return { status: "processed", detail: `Subscription active=${active}` };
  }

  if (event.type === "invoice.payment_failed") {
    return { status: "processed", detail: "Payment failure recorded; Stripe retry settings remain authoritative" };
  }

  return { status: "ignored", detail: "Event type is not used by the app" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return jsonResponse(res, 405, { error: "Method not allowed" });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return jsonResponse(res, 503, { error: "Webhook not configured" });

  let event = null;
  try {
    const raw = await readRaw(req);
    if (!verifyStripeSignature(raw, req.headers["stripe-signature"], secret)) {
      return jsonResponse(res, 400, { error: "Invalid signature" });
    }
    event = JSON.parse(raw.toString("utf8"));
    await recordWebhook(event, "received");
    const result = await processEvent(event);
    await recordWebhook(event, result.status, result.detail);
    return jsonResponse(res, 200, { received: true, status: result.status });
  } catch (error) {
    console.error(error);
    if (event) await recordWebhook(event, "failed", error.message);
    return jsonResponse(res, 500, { error: "Webhook failed" });
  }
}
