import { requireAdmin } from "../lib/admin-auth.js";
import { jsonResponse, supabaseRequest } from "../lib/well-core.js";
import { PACKS, expectedPriceId } from "../lib/commerce.js";


async function stripeGet(path) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `Stripe lookup failed: ${response.status}`);
  return data;
}

export async function inspectStripeCatalog() {
  const expectations = {
    copper_10: { amount: 299, currency: "usd", recurring: false },
    moon_30: { amount: 499, currency: "usd", recurring: false },
    keeper_monthly: { amount: 499, currency: "usd", recurring: true, interval: "month" }
  };
  const rows = [];
  for (const pack of Object.values(PACKS)) {
    const priceId = expectedPriceId(pack);
    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      rows.push({ key: pack.key, priceId: priceId || null, configured: Boolean(priceId), aligned: false, reason: !priceId ? "Price ID missing" : "Stripe key missing" });
      continue;
    }
    try {
      const price = await stripeGet(`prices/${encodeURIComponent(priceId)}`);
      const expected = expectations[pack.key];
      const recurring = Boolean(price?.recurring);
      const aligned = Boolean(
        price?.active &&
        Number(price?.unit_amount) === expected.amount &&
        String(price?.currency || "").toLowerCase() === expected.currency &&
        recurring === expected.recurring &&
        (!expected.interval || price?.recurring?.interval === expected.interval)
      );
      rows.push({
        key: pack.key,
        priceId,
        configured: true,
        aligned,
        active: Boolean(price?.active),
        unitAmount: Number(price?.unit_amount || 0),
        currency: price?.currency || null,
        recurring: price?.recurring?.interval || null,
        expectedAmount: expected.amount,
        expectedRecurring: expected.interval || null,
        reason: aligned ? "Matches the app" : "Stripe price does not match the app display"
      });
    } catch (error) {
      rows.push({ key: pack.key, priceId, configured: true, aligned: false, reason: error.message });
    }
  }
  return { aligned: rows.length === 3 && rows.every(row => row.aligned), rows };
}

function countBy(rows, key) {
  return rows.reduce((result, row) => {
    const value = row[key] || "unknown";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

export default async function handler(req, res) {
  if (req.method !== "GET") return jsonResponse(res, 405, { error: "Method not allowed" });
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const [profiles, wishes, creditEvents, webhookEvents, stripeCatalog] = await Promise.all([
      supabaseRequest("well_profiles?select=session_id,created_at,last_seen,daily_claim_date,copper_credits,moon_credits,subscription_active,total_wishes,stripe_customer_id&order=last_seen.desc&limit=250", { method: "GET" }),
      supabaseRequest("wishes?select=id,session_id,coin_source,theme,mood,created_at&order=created_at.desc&limit=5000", { method: "GET" }),
      supabaseRequest("well_credit_events?select=id,session_id,stripe_event_id,credits,coin_type,pack,source,created_at&order=created_at.desc&limit=100", { method: "GET" }),
      supabaseRequest("well_webhook_events?select=stripe_event_id,event_type,status,detail,created_at,updated_at&order=updated_at.desc&limit=100", { method: "GET" }),
      inspectStripeCatalog()
    ]);

    const now = Date.now();
    const dayAgo = now - 86400000;
    const weekAgo = now - 7 * 86400000;
    const totalCopper = (profiles || []).reduce((sum, row) => sum + Number(row.copper_credits || 0), 0);
    const totalMoon = (profiles || []).reduce((sum, row) => sum + Number(row.moon_credits || 0), 0);

    return jsonResponse(res, 200, {
      admin: { email: user.email },
      health: {
        database: true,
        stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
        webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        copperPrice: Boolean(process.env.STRIPE_PRICE_COPPER_10),
        moonPrice: Boolean(process.env.STRIPE_PRICE_MOON_30),
        keeperPrice: Boolean(process.env.STRIPE_PRICE_KEEPER_MONTHLY),
        openai: Boolean(process.env.OPENAI_API_KEY),
        stripeCatalog: Boolean(stripeCatalog?.aligned)
      },
      stripeCatalog,
      totals: {
        profiles: profiles?.length || 0,
        wishes: wishes?.length || 0,
        wishes24h: (wishes || []).filter(row => new Date(row.created_at).getTime() >= dayAgo).length,
        wishes7d: (wishes || []).filter(row => new Date(row.created_at).getTime() >= weekAgo).length,
        subscriptions: (profiles || []).filter(row => row.subscription_active).length,
        copperOutstanding: totalCopper,
        moonOutstanding: totalMoon
      },
      coinUsage: countBy(wishes || [], "coin_source"),
      themes: countBy(wishes || [], "theme"),
      profiles: profiles || [],
      creditEvents: creditEvents || [],
      webhookEvents: webhookEvents || []
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(res, 500, { error: "Admin data could not be loaded. Run the latest Supabase schema or migration first." });
  }
}
