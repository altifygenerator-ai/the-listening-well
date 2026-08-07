import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFile(path.join(root, file), "utf8");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(value = "") { this.body += String(value); },
    json() { return this.body ? JSON.parse(this.body) : null; }
  };
}

function request({ method = "GET", url = "/", headers = {}, body = undefined } = {}) {
  return { method, url, headers, body, socket: { remoteAddress: "127.0.0.1" } };
}

function signedStripeRequest(event, secret) {
  const raw = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return request({
    method: "POST",
    url: "/api/stripe-webhook",
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    body: raw
  });
}

async function syntaxCheck() {
  const files = [];
  for (const directory of ["api", "lib", "public", "scripts"]) {
    const entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) files.push(path.join(directory, entry.name));
    }
  }
  files.push("server.mjs");
  for (const file of files) {
    if (file === "scripts/check-project.mjs") continue;
    const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, `${file} failed syntax check:\n${result.stderr}`);
  }
  return files.length;
}

async function staticAudit() {
  const index = await read("public/index.html");
  const admin = await read("public/admin.html");
  const app = await read("public/app.js");
  const adminJs = await read("public/admin.js");
  const ids = html => [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(match => match[1]);
  for (const [label, html] of [["index", index], ["admin", admin]]) {
    const values = ids(html);
    assert.equal(new Set(values).size, values.length, `${label}.html contains duplicate IDs`);
  }
  const appIds = [...app.matchAll(/\$\(["']#([^"']+)["']\)/g)].map(match => match[1]);
  const adminIds = [...adminJs.matchAll(/\$\(["']#([^"']+)["']\)/g)].map(match => match[1]);
  const indexSet = new Set(ids(index));
  const adminSet = new Set(ids(admin));
  assert.deepEqual([...new Set(appIds)].filter(id => !indexSet.has(id)), [], "public/app.js references missing HTML IDs");
  assert.deepEqual([...new Set(adminIds)].filter(id => !adminSet.has(id)), [], "public/admin.js references missing HTML IDs");

  const vercel = JSON.parse(await read("vercel.json"));
  const routeMap = new Map(vercel.routes.map(route => [route.src, route.dest]));
  for (const name of ["setup", "login", "logout", "me", "dashboard", "grant"]) {
    assert.equal(routeMap.get(`/api/admin/${name}`), `/api/admin-${name}.js`, `Missing Vercel route for admin ${name}`);
  }
  return { indexIds: indexSet.size, adminIds: adminSet.size };
}

async function commerceAudit() {
  const { PACKS } = await import("../lib/commerce.js");
  assert.deepEqual(Object.keys(PACKS), ["copper_10", "moon_30", "keeper_monthly"]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(PACKS).map(([key, pack]) => [key, { credits: pack.credits, coinType: pack.coinType, mode: pack.mode }])),
    {
      copper_10: { credits: 10, coinType: "copper", mode: "payment" },
      moon_30: { credits: 30, coinType: "moon", mode: "payment" },
      keeper_monthly: { credits: 90, coinType: "moon", mode: "subscription" }
    }
  );
}

async function openAIAudit() {
  const { generateOpenAIWish } = await import("../lib/well-core.js");
  const originalFetch = globalThis.fetch;
  let payload = null;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        answer: "A moon answer.", meaning: "A useful meaning.", nextStep: "Take one step.",
        shareLine: "A strong private share line.", followUpQuestion: "What changed?", mood: "moonlit", theme: "change"
      })
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await generateOpenAIWish({ wish: "I wish for change", apiKey: "test", depth: "moon", safetyIdentifier: "session" });
    assert.equal(result.source, "openai-moon");
    assert.match(payload.input, /RESPONSE MODE: MOON WATER/);
    assert.equal(payload.text.format.type, "json_schema");
    assert.equal(payload.text.format.strict, true);
    assert.equal(payload.store, false);
    assert.ok(payload.safety_identifier);

    payload = null;
    const followUpResult = await generateOpenAIWish({
      wish: "I wish I could make my business dependable",
      apiKey: "test",
      depth: "deep",
      safetyIdentifier: "session",
      priorContext: [{ theme: "money", wish: "I want steadier income", createdAt: "2026-08-01T12:00:00.000Z" }],
      followUp: {
        direction: "action",
        question: "What should I do first?",
        originalAnswer: "Choose one path and stay with it.",
        originalMeaning: "You want stability more than novelty."
      }
    });
    assert.equal(followUpResult.source, "openai-deep-follow-up");
    assert.match(payload.input, /CONVERSATION TYPE: FOLLOW-UP/);
    assert.match(payload.input, /FOLLOW-UP DIRECTION: ACTION/);
    assert.match(payload.input, /What should I do first\?/);
    assert.match(payload.input, /RECENT PRIVATE CONTEXT/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function checkoutAudit() {
  process.env.APP_URL = "https://example.com";
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_PRICE_COPPER_10 = "price_copper";
  process.env.STRIPE_PRICE_MOON_30 = "price_moon";
  process.env.STRIPE_PRICE_KEEPER_MONTHLY = "price_keeper";
  const { default: handler } = await import("../api/checkout.js");
  const originalFetch = globalThis.fetch;
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const seen = [];
  globalThis.fetch = async (_url, options) => {
    seen.push(new URLSearchParams(options.body));
    return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    for (const [pack, price, coin, mode] of [
      ["copper_10", "price_copper", "copper", "payment"],
      ["moon_30", "price_moon", "moon", "payment"],
      ["keeper_monthly", "price_keeper", "moon", "subscription"]
    ]) {
      const res = responseRecorder();
      await handler(request({ method: "POST", headers: { host: "example.com" }, body: { pack, sessionId } }), res);
      assert.equal(res.statusCode, 200);
      const form = seen.at(-1);
      assert.equal(form.get("line_items[0][price]"), price);
      assert.equal(form.get("metadata[pack]"), pack);
      assert.equal(form.get("metadata[coin_type]"), coin);
      assert.equal(form.get("mode"), mode);
      if (mode === "subscription") assert.equal(form.get("subscription_data[metadata][pack]"), pack);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}


async function stripeCatalogAudit() {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_PRICE_COPPER_10 = "price_copper";
  process.env.STRIPE_PRICE_MOON_30 = "price_moon";
  process.env.STRIPE_PRICE_KEEPER_MONTHLY = "price_keeper";
  const { inspectStripeCatalog } = await import("../api/admin-dashboard.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const id = String(url).split("/").at(-1);
    const rows = {
      price_copper: { id, active: true, unit_amount: 299, currency: "usd", recurring: null },
      price_moon: { id, active: true, unit_amount: 499, currency: "usd", recurring: null },
      price_keeper: { id, active: true, unit_amount: 499, currency: "usd", recurring: { interval: "month" } }
    };
    return new Response(JSON.stringify(rows[id]), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await inspectStripeCatalog();
    assert.equal(result.aligned, true);
    assert.equal(result.rows.length, 3);
  } finally { globalThis.fetch = originalFetch; }
}

async function webhookAudit() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_PRICE_COPPER_10 = "price_copper";
  process.env.STRIPE_PRICE_MOON_30 = "price_moon";
  process.env.STRIPE_PRICE_KEEPER_MONTHLY = "price_keeper";
  const { default: handler } = await import("../api/stripe-webhook.js");
  const originalFetch = globalThis.fetch;
  const sessionId = "22222222-2222-4222-8222-222222222222";
  const rpcCalls = [];
  let currentPrice = "price_copper";
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("api.stripe.com/v1/checkout/sessions/") && value.includes("line_items")) {
      return new Response(JSON.stringify({ data: [{ price: { id: currentPrice } }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.includes("api.stripe.com/v1/subscriptions/")) {
      return new Response(JSON.stringify({
        id: "sub_1", customer: "cus_1", status: "active", metadata: { pack: "keeper_monthly", session_id: sessionId },
        items: { data: [{ price: { id: "price_keeper" } }] }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.includes("/rest/v1/rpc/")) {
      rpcCalls.push({ url: value, body: options.body ? JSON.parse(options.body) : null });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch in webhook test: ${value}`);
  };
  try {
    for (const [pack, price, coin, credits] of [
      ["copper_10", "price_copper", "copper", 10],
      ["moon_30", "price_moon", "moon", 30],
      ["keeper_monthly", "price_keeper", "moon", 90]
    ]) {
      currentPrice = price;
      rpcCalls.length = 0;
      const event = {
        id: `evt_${pack}`,
        type: "checkout.session.completed",
        data: { object: { id: `cs_${pack}`, payment_status: "paid", customer: "cus_1", client_reference_id: sessionId, metadata: { pack, session_id: sessionId } } }
      };
      const res = responseRecorder();
      await handler(signedStripeRequest(event, process.env.STRIPE_WEBHOOK_SECRET), res);
      assert.equal(res.statusCode, 200, res.body);
      const grant = rpcCalls.find(call => call.url.endsWith("/rpc/grant_well_credits"));
      assert.ok(grant, `No credit grant for ${pack}`);
      assert.equal(grant.body.p_coin_type, coin);
      assert.equal(grant.body.p_credits, credits);
      assert.equal(grant.body.p_pack, pack);
    }

    rpcCalls.length = 0;
    const renewal = {
      id: "evt_renewal",
      type: "invoice.paid",
      data: { object: { id: "in_1", billing_reason: "subscription_cycle", customer: "cus_1", parent: { subscription_details: { subscription: "sub_1" } } } }
    };
    const renewalRes = responseRecorder();
    await handler(signedStripeRequest(renewal, process.env.STRIPE_WEBHOOK_SECRET), renewalRes);
    assert.equal(renewalRes.statusCode, 200, renewalRes.body);
    const renewalGrant = rpcCalls.find(call => call.url.endsWith("/rpc/grant_well_credits"));
    assert.equal(renewalGrant.body.p_coin_type, "moon");
    assert.equal(renewalGrant.body.p_credits, 90);
    assert.equal(renewalGrant.body.p_subscription_active, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
}


async function adminSetupAudit() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.ADMIN_EMAILS = "altifygenerator@gmail.com";
  process.env.ADMIN_SETUP_TOKEN = "a".repeat(64);
  const { default: handler } = await import("../api/admin-setup.js");
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", headers: options.headers, body: options.body ? JSON.parse(options.body) : null });
    const value = String(url);
    if (value.includes("/auth/v1/admin/users?page=")) return new Response(JSON.stringify({ users: [] }), { status: 200, headers: { "content-type": "application/json" } });
    if (value.endsWith("/auth/v1/admin/users")) return new Response(JSON.stringify({ id: "auth-user", email: "altifygenerator@gmail.com" }), { status: 200, headers: { "content-type": "application/json" } });
    if (value.includes("/auth/v1/token?grant_type=password")) return new Response(JSON.stringify({ access_token: "user.jwt.token", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
    throw new Error(`Unexpected fetch in admin setup test: ${value}`);
  };
  try {
    const res = responseRecorder();
    await handler(request({ method: "POST", body: { email: "altifygenerator@gmail.com", password: "testing-password-123", setupToken: process.env.ADMIN_SETUP_TOKEN } }), res);
    assert.equal(res.statusCode, 200, res.body);
    assert.match(String(res.headers["set-cookie"] || ""), /lw_admin_access=/);
    const create = calls.find(call => call.url.endsWith("/auth/v1/admin/users") && call.method === "POST");
    assert.equal(create.body.email, "altifygenerator@gmail.com");
    assert.equal(create.body.email_confirm, true);
    assert.equal(create.body.app_metadata.role, "admin");
    assert.equal(calls[0].headers.apikey, "sb_secret_test");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function refundAudit() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  delete process.env.OPENAI_API_KEY;
  const { default: handler } = await import("../api/wish.js");
  const originalFetch = globalThis.fetch;
  const rpcNames = [];
  globalThis.fetch = async (url) => {
    const value = String(url);
    const rpcMatch = value.match(/\/rpc\/([^?]+)/);
    if (rpcMatch) {
      const name = rpcMatch[1];
      rpcNames.push(name);
      if (name === "consume_well_coin") return new Response(JSON.stringify({ allowed: true, source: "moon" }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.endsWith("/rest/v1/wishes")) return new Response(JSON.stringify({ message: "forced insert failure" }), { status: 500, headers: { "content-type": "application/json" } });
    throw new Error(`Unexpected fetch in refund test: ${value}`);
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    const res = responseRecorder();
    await handler(request({
      method: "POST",
      headers: { "x-forwarded-for": "192.0.2.10" },
      body: { sessionId: "33333333-3333-4333-8333-333333333333", wish: "I wish for a fresh start", coinIntent: "moon", priorThemes: [] }
    }), res);
    assert.equal(res.statusCode, 500);
    assert.ok(rpcNames.includes("restore_well_coin"), "Consumed coin was not restored after persistence failure");
  } finally {
    console.error = originalError;
    globalThis.fetch = originalFetch;
  }
}

async function sqlAudit() {
  const schema = await read("supabase/schema.sql");
  const migration = await read("supabase/migrations/20260804_coin_wallet_admin.sql");
  for (const sql of [schema, migration]) {
    for (const required of ["copper_credits", "moon_credits", "consume_well_coin", "restore_well_coin", "grant_well_credits", "record_well_webhook_event", "set_well_subscription"]) {
      assert.ok(sql.includes(required), `SQL is missing ${required}`);
    }
    assert.match(sql, /grant execute on function public\.restore_well_coin\(uuid, text\) to service_role/);
  }
}

const results = {};
results.syntaxFiles = await syntaxCheck();
results.dom = await staticAudit();
await commerceAudit();
await openAIAudit();
await checkoutAudit();
await stripeCatalogAudit();
await webhookAudit();
await adminSetupAudit();
await refundAudit();
await sqlAudit();
console.log(JSON.stringify({ ok: true, ...results }, null, 2));
