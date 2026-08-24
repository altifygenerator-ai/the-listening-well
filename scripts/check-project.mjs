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
  const req = {
    method: "POST",
    url: "/api/stripe-webhook",
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() { yield raw; }
  };
  // Simulate Vercel's lazy body helper. Stripe verification must never access it.
  Object.defineProperty(req, "body", {
    configurable: true,
    get() { throw new Error("Webhook touched parsed req.body before reading raw bytes"); }
  });
  return req;
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

  const privacy = await read("public/privacy.html");
  const terms = await read("public/terms.html");
  const robots = await read("public/robots.txt");
  const wishApi = await read("api/wish.js");
  const core = await read("lib/well-core.js");
  assert.ok(!/localWishResponse/.test(wishApi), "Wish API must never substitute a canned local response");
  assert.ok(!/clientFallbackResponse/.test(app), "Browser must never substitute a canned normal wish response");
  assert.ok(!/export function localWishResponse/.test(core), "Canned server wish-response bank must stay removed");
  const customerSurface = `${index}\n${app}\n${privacy}\n${terms}`;
  for (const forbidden of [
    /Connect Supabase/i,
    /Stripe price IDs/i,
    /webhook log in Admin/i,
    /API keys are never exposed/i,
    /Account-based storage can be added later/i,
    /Payments are ready for keys/i,
    /good enough to keep/i
  ]) {
    assert.ok(!forbidden.test(customerSurface), `Customer-facing implementation copy leaked: ${forbidden}`);
  }
  assert.match(admin, /noindex,nofollow,noarchive/i, "Admin page must not be indexable");
  assert.match(robots, /Disallow: \/admin\.html/, "robots.txt should keep the admin page out of crawl paths");
  assert.match(index, /Throw a Penny \| A Digital Wishing Well/, "Public title should describe the experience rather than the implementation");
  assert.match(index, /id="manageKeeperButton"/, "Well Keeper needs a customer-visible management path");
  assert.match(app, /function dailyDateKey/, "Daily penny client date must align with the server date boundary");
  assert.match(app, /Nothing was cleared because we could not confirm the saved copy was removed/, "Journal deletion must fail safely if cloud deletion cannot be confirmed");
  assert.match(app, /navigator\.serviceWorker\.addEventListener\("controllerchange"/, "Existing PWA sessions should reload when a new service worker takes control");
  for (const asset of ["/", "/sw.js", "/app.js", "/styles.css"]) {
    const route = vercel.routes.find(candidate => candidate.src === asset);
    assert.match(String(route?.headers?.["Cache-Control"] || ""), /max-age=0/, `${asset} must revalidate so customers do not stay on stale releases`);
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
  const payloads = [];
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    payloads.push(payload);
    const input = String(payload?.input || "");
    const response = /sister/i.test(input)
      ? {
          answer: "You want conversations with your sister to stop turning into arguments, not simply to prove who is right.",
          meaning: "The relationship matters enough that the repeated conflict is becoming the real problem.",
          nextStep: "Choose one recent argument and identify the exact point where the conversation changed tone.",
          shareLine: "Sometimes changing the pattern matters more than winning the point.",
          followUpQuestion: "What usually happens just before the argument starts?",
          moonNote: null, mood: "steady", theme: "family"
        }
      : /business/i.test(input)
        ? {
            answer: "You want your business to feel dependable enough that income is not a fresh question every month.",
            meaning: "The useful issue is repeatability, not abstract growth.",
            nextStep: "Look at the last five customers and identify the one source you could deliberately repeat this week.",
            shareLine: "Dependable work is built from what can be repeated.",
            followUpQuestion: "Which source of work has repeated most reliably?",
            moonNote: null, mood: "steady", theme: "work"
          }
        : {
            answer: "You are wishing for change, so the useful question is what you want to be different rather than change for its own sake.",
            meaning: "A clearer target will make the wish easier to act on.",
            nextStep: "Name the one part of your current situation you most want changed.",
            shareLine: "Change gets clearer when you name what must be different.",
            followUpQuestion: "What would you notice first if the change happened?",
            moonNote: "If the change comes, notice which part came from your choice and which part came from circumstance.",
            mood: "moonlit", theme: "change"
          };
    return new Response(JSON.stringify({ output_text: JSON.stringify(response) }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await generateOpenAIWish({ wish: "I wish for change", apiKey: "test", depth: "moon", safetyIdentifier: "session" });
    assert.equal(result.source, "openai-moon");
    const moonPayload = payloads[0];
    assert.match(moonPayload.input, /RESPONSE MODE: MOON WATER/);
    assert.equal(moonPayload.store, false);
    assert.equal(moonPayload.text, undefined, "Normal wish generation should use the bare Responses API shape first");
    assert.equal(payloads.some(payload => payload?.text?.format?.name === "well_quality"), false, "Normal wishes should not require a second editor-model call");

    payloads.length = 0;
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
    const followPayload = payloads[0];
    assert.match(followPayload.input, /CONVERSATION TYPE: FOLLOW-UP/);
    assert.match(followPayload.input, /FOLLOW-UP DIRECTION: ACTION/);
    assert.match(followPayload.input, /What should I do first\?/);

    payloads.length = 0;
    const freeResult = await generateOpenAIWish({
      wish: "I wish my sister and I could talk without every conversation becoming an argument",
      apiKey: "test",
      depth: "clarify",
      safetyIdentifier: "session",
      followUp: {
        direction: "clarity",
        question: "What am I overlooking here?",
        originalAnswer: "The conflict matters because the relationship matters.",
        originalMeaning: "You want a different pattern, not simply to win an argument."
      }
    });
    assert.equal(freeResult.source, "openai-clarify-follow-up");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function qualityRetryAudit() {
  const { generateOpenAIWish } = await import("../lib/well-core.js");
  const originalFetch = globalThis.fetch;
  let responseCalls = 0;
  globalThis.fetch = async (_url, options) => {
    responseCalls += 1;
    const corrected = responseCalls > 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        answer: corrected
          ? "You want enough repeat landscaping customers that payroll stops being a fresh uncertainty every month."
          : "Trust the journey and keep moving forward.",
        meaning: corrected
          ? "The wish is about dependable demand rather than one unusually good month."
          : "Your path may be asking you to believe in yourself.",
        nextStep: corrected
          ? "Identify the landscaping service that produced the most repeat work and contact three past customers connected to it."
          : "Take a small step.",
        shareLine: "Steady work comes from finding what can be repeated.",
        followUpQuestion: "Which source of repeat work has been most reliable?",
        moonNote: null,
        mood: "steady",
        theme: "work"
      })
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await generateOpenAIWish({
      wish: "I wish my landscaping business had enough repeat customers to cover payroll every month",
      apiKey: "test",
      model: "gpt-5"
    });
    assert.equal(responseCalls, 2, "A deterministically generic first draft should trigger exactly one regeneration");
    assert.match(result.answer, /repeat landscaping customers/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function qualityHardStopAudit() {
  const { generateOpenAIWish } = await import("../lib/well-core.js");
  const originalFetch = globalThis.fetch;
  let responseCalls = 0;
  globalThis.fetch = async () => {
    responseCalls += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        answer: "Keep going and trust yourself.",
        meaning: "This may be about growth.",
        nextStep: "Take a small step.",
        shareLine: "Keep moving toward what matters.",
        followUpQuestion: "What matters next?",
        moonNote: null,
        mood: "steady",
        theme: "uncertainty"
      })
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await generateOpenAIWish({
      wish: "I wish my business had enough repeat landscaping customers to cover payroll every month",
      apiKey: "test",
      model: "gpt-5"
    });
    assert.equal(responseCalls, 2, "A weak response should get one rewrite and then stop");
    assert.ok(result.answer, "A valid response must still be returned even if the rewrite remains imperfect");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function shortWishAudit() {
  const { generateOpenAIWish } = await import("../lib/well-core.js");
  const originalFetch = globalThis.fetch;
  let responseCalls = 0;
  globalThis.fetch = async () => {
    responseCalls += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        answer: "Wanting more height is straightforward, but whether you may still grow depends on your age and growth stage. There is no honest way to promise more height from the information here. If you are still growing, time and genetics matter; if you are fully grown, natural height is generally not something you can meaningfully change.",
        meaning: "There does not have to be a deeper meaning behind wanting to be taller.",
        nextStep: "If you want to know whether more growth is realistically possible, the useful next fact is whether you are still in a normal growth stage.",
        shareLine: "Some wishes become clearer when you separate what may still change from what may not.",
        followUpQuestion: "Is this mostly about whether you may still grow, or about how your current height affects you?",
        moonNote: null,
        mood: "steady",
        theme: "health"
      })
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await generateOpenAIWish({ wish: "I wish I was taller", apiKey: "test", model: "gpt-5" });
    assert.equal(responseCalls, 1, "A valid short wish must not be rejected just because the answer uses a natural synonym like height");
    assert.match(result.answer, /height/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
}


async function responseCompatibilityAudit() {
  const { generateOpenAIWish } = await import("../lib/well-core.js");
  const originalFetch = globalThis.fetch;
  const models = [];
  let firstPayloadForMini = true;
  globalThis.fetch = async (_url, options = {}) => {
    const payload = JSON.parse(options.body || "{}");
    models.push(payload.model);
    if (payload.model === "gpt-5") {
      return new Response(JSON.stringify({ error: { code: "model_not_found", message: "configured model unavailable" } }), { status: 404, headers: { "content-type": "application/json" } });
    }
    if (payload.model === "gpt-5-mini" && firstPayloadForMini) {
      firstPayloadForMini = false;
      return new Response(JSON.stringify({ output_text: "not-json" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ output_text: JSON.stringify({
      answer: "Wanting more height is straightforward, but whether more growth is possible depends on your age and growth stage.",
      meaning: "There may not be a deeper meaning behind wanting to be taller, and the information given is not enough to predict more growth.",
      nextStep: "If you want a realistic answer about more growth, the useful next fact is whether you are still in a normal growth stage.",
      shareLine: "Some wishes get clearer when you separate what may change from what may not.",
      followUpQuestion: "Are you mainly wondering whether you may still grow, or how to feel better about your current height?",
      moonNote: null, mood: "steady", theme: "health"
    }) }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await generateOpenAIWish({ wish: "I wish I was taller", apiKey: "test", model: "gpt-5" });
    assert.match(result.answer, /height|growth/i);
    assert.ok(models.includes("gpt-5-mini"), "The fallback model should be tried when the configured model is unavailable");
    assert.equal(models.filter(model => model === "gpt-5-mini").length, 2, "An unparseable successful response should get one JSON-mode retry");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function wishReadinessAudit() {
  const { default: handler } = await import("../api/wish-check.js");
  const shortSpecific = responseRecorder();
  await handler(request({ method: "POST", body: {
    sessionId: "99999999-9999-4999-8999-999999999999",
    wish: "I wish I was taller"
  } }), shortSpecific);
  assert.equal(shortSpecific.statusCode, 200, shortSpecific.body);
  assert.equal(shortSpecific.json().ready, true, "A simple but specific wish like wanting to be taller should go straight to the well");

  const vague = responseRecorder();
  await handler(request({ method: "POST", body: {
    sessionId: "99999999-9999-4999-8999-999999999998",
    wish: "I wish I was happy"
  } }), vague);
  assert.equal(vague.statusCode, 200, vague.body);
  assert.equal(vague.json().ready, false, "A truly vague wish should get one clarification question before the toss");
}

async function freeFollowUpAudit() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.OPENAI_API_KEY = "test";
  const { default: handler } = await import("../api/wish.js");
  const originalFetch = globalThis.fetch;
  const sessionId = "33333333-3333-4333-8333-333333333333";
  const parentId = "44444444-4444-4444-8444-444444444444";
  const seen = [];
  let alreadyUsed = false;

  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("api.openai.com/v1/moderations")) {
      return new Response(JSON.stringify({ results: [{ flagged: false, categories: {} }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.includes("api.openai.com/v1/responses")) {
      const payload = JSON.parse(options.body || "{}");
      if (payload?.text?.format?.name === "well_quality") {
        return new Response(JSON.stringify({ output_text: JSON.stringify({
          specificity: 5, directness: 5, grounding: 5, usefulness: 5, genericRisk: false, inventedDetails: false, critique: "Specific."
        }) }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ output_text: JSON.stringify({
        answer: "You want conversations with your sister to stop becoming arguments, and the useful place to look is what happens immediately before the tone changes.",
        meaning: "This is about changing a repeated conversation pattern while protecting a relationship you still care about.",
        nextStep: "Think of the last argument with your sister and write down the sentence or topic that changed the tone.",
        shareLine: "Changing the pattern can matter more than winning the point.",
        followUpQuestion: "What usually happens right before the argument starts?",
        moonNote: null, mood: "steady", theme: "family"
      }) }), { status: 200, headers: { "content-type": "application/json" } });
    }
    seen.push({ url: value, method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    if (value.includes("/rest/v1/wishes?id=eq.") && (options.method || "GET") === "GET") {
      return new Response(JSON.stringify([{ id: parentId }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.includes("response_kind=eq.follow_up") && value.includes("coin_source=eq.local") && (options.method || "GET") === "GET") {
      return new Response(JSON.stringify(alreadyUsed ? [{ id: "55555555-5555-4555-8555-555555555555" }] : []), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.endsWith("/rest/v1/rpc/touch_well_profile")) {
      return new Response(JSON.stringify([{ session_id: sessionId }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.endsWith("/rest/v1/wishes") && options.method === "POST") {
      return new Response(JSON.stringify([{ id: "66666666-6666-4666-8666-666666666666" }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch in free follow-up test: ${value}`);
  };

  const body = {
    sessionId,
    clientVersion: "1.7.5",
    wish: "I wish my sister and I could talk without every conversation becoming an argument",
    coinIntent: "free",
    followUp: {
      parentCloudId: parentId,
      originalAnswer: "You want the pattern between you to change.",
      originalMeaning: "The relationship matters enough that the repeated arguments are wearing on you.",
      question: "What am I overlooking here?",
      direction: "clarity"
    }
  };

  try {
    const res = responseRecorder();
    await handler(request({ method: "POST", body }), res);
    assert.equal(res.statusCode, 200, res.body);
    const data = res.json();
    assert.equal(data.coinSource, "free");
    assert.equal(data.followUpTier, "free");
    assert.equal(data.responseKind, "follow_up");
    assert.ok(!seen.some(call => call.url.includes("/rpc/consume_well_coin")), "Free follow-up consumed a paid/daily coin");

    alreadyUsed = true;
    const duplicate = responseRecorder();
    await handler(request({ method: "POST", body }), duplicate);
    assert.equal(duplicate.statusCode, 409, duplicate.body);
    assert.equal(duplicate.json().code, "FREE_FOLLOW_UP_USED");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
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
  process.env.OPENAI_API_KEY = "test";
  const { default: handler } = await import("../api/wish.js");
  const originalFetch = globalThis.fetch;
  const rpcNames = [];
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("api.openai.com/v1/moderations")) {
      return new Response(JSON.stringify({ results: [{ flagged: false, categories: {} }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.includes("api.openai.com/v1/responses")) {
      const payload = JSON.parse(options.body || "{}");
      if (payload?.text?.format?.name === "well_quality") {
        return new Response(JSON.stringify({ output_text: JSON.stringify({
          specificity: 5, directness: 5, grounding: 5, usefulness: 5, genericRisk: false, inventedDetails: false, critique: "Specific."
        }) }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ output_text: JSON.stringify({
        answer: "You want a fresh start, and the useful part is identifying which part of your current situation you most need to leave behind.",
        meaning: "A fresh start becomes concrete when you name what must actually be different.",
        nextStep: "Write down the first visible difference you would expect from that fresh start and one action that could create it.",
        shareLine: "A fresh start becomes real when you can name what must change.",
        followUpQuestion: "What would feel different first?",
        moonNote: "A fresh start does not require erasing what came before. It does require deciding what you will not carry forward unchanged.",
        mood: "brave", theme: "change"
      }) }), { status: 200, headers: { "content-type": "application/json" } });
    }
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
      body: { sessionId: "33333333-3333-4333-8333-333333333333", clientVersion: "1.7.5", wish: "I wish for a fresh start", coinIntent: "moon", priorThemes: [] }
    }), res);
    assert.equal(res.statusCode, 200, res.body);
    const payload = res.json();
    assert.equal(payload.cloudSaved, false, "A cloud-save failure should be reported without discarding the answer");
    assert.ok(payload.answer, "The generated answer should still be returned after a cloud-save failure");
    assert.equal(rpcNames.includes("restore_well_coin"), false, "A penny should remain consumed when the user received the answer");
  } finally {
    console.error = originalError;
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
}


async function generationFailureRestoresCoinAudit() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.OPENAI_API_KEY = "test";
  const { default: handler } = await import("../api/wish.js");
  const originalFetch = globalThis.fetch;
  const rpcNames = [];
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.includes("api.openai.com/v1/moderations")) {
      return new Response(JSON.stringify({ results: [{ flagged: false, categories: {} }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.includes("api.openai.com/v1/responses")) {
      return new Response(JSON.stringify({ error: { code: "server_error", message: "forced model failure" } }), { status: 500, headers: { "content-type": "application/json" } });
    }
    const rpcMatch = value.match(/\/rpc\/([^?]+)/);
    if (rpcMatch) {
      const name = rpcMatch[1];
      rpcNames.push(name);
      if (name === "consume_well_coin") return new Response(JSON.stringify({ allowed: true, source: "copper" }), { status: 200, headers: { "content-type": "application/json" } });
      if (name === "restore_well_coin") return new Response(JSON.stringify({ restored: true }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch in generation failure test: ${value}`);
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    const res = responseRecorder();
    await handler(request({ method: "POST", body: {
      sessionId: "22222222-2222-4222-8222-222222222222",
      clientVersion: "1.7.5",
      wish: "I wish I was taller",
      coinIntent: "copper"
    } }), res);
    assert.equal(res.statusCode, 502, res.body);
    assert.equal(res.json().code, "AI_RESPONSE_FAILED");
    assert.ok(rpcNames.includes("restore_well_coin"), "A consumed penny must be restored when generation fails");
  } finally {
    console.error = originalError;
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
}

async function cancelKeeperAudit() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_PRICE_KEEPER_MONTHLY = "price_keeper";
  const { default: handler } = await import("../api/cancel-keeper.js");
  const originalFetch = globalThis.fetch;
  const sessionId = "77777777-7777-4777-8777-777777777777";
  const seen = [];
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    seen.push({ url: value, method: options.method || "GET", body: options.body });
    if (value.includes("/rest/v1/well_profiles?")) {
      return new Response(JSON.stringify([{ stripe_customer_id: "cus_keeper", subscription_active: true }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.includes("api.stripe.com/v1/subscriptions?") && (options.method || "GET") === "GET") {
      return new Response(JSON.stringify({ data: [{
        id: "sub_keeper", status: "active", cancel_at_period_end: false, current_period_end: 1780000000,
        items: { data: [{ price: { id: "price_keeper" } }] }
      }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.endsWith("api.stripe.com/v1/subscriptions/sub_keeper") && options.method === "POST") {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get("cancel_at_period_end"), "true");
      return new Response(JSON.stringify({ id: "sub_keeper", cancel_at_period_end: true, current_period_end: 1780000000 }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (value.endsWith("/rest/v1/rpc/set_well_subscription")) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_active, false);
      assert.equal(body.p_session_id, sessionId);
      return new Response(JSON.stringify({ updated: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected fetch in cancel keeper test: ${value}`);
  };
  try {
    const res = responseRecorder();
    await handler(request({ method: "POST", body: { sessionId } }), res);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().cancelled, true);
    assert.ok(seen.some(call => call.url.endsWith("api.stripe.com/v1/subscriptions/sub_keeper")));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function deleteSessionAudit() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  const { default: handler } = await import("../api/delete-session.js");
  const originalFetch = globalThis.fetch;
  const sessionId = "88888888-8888-4888-8888-888888888888";
  let deleted = false;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes(`/rest/v1/well_profiles?session_id=eq.${sessionId}`) && options.method === "DELETE") {
      deleted = true;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch in delete-session test: ${url}`);
  };
  try {
    const res = responseRecorder();
    await handler(request({ method: "POST", body: { sessionId } }), res);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().deleted, true);
    assert.equal(deleted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function sqlAudit() {
  const schema = await read("supabase/schema.sql");
  const migration = await read("supabase/migrations/20260804_coin_wallet_admin.sql");
  const personalMigration = await read("supabase/migrations/20260821_personal_readings.sql");
  assert.match(schema, /clarification_text text/);
  assert.match(schema, /moon_note text/);
  assert.match(personalMigration, /add column if not exists clarification_text/);
  assert.match(personalMigration, /add column if not exists moon_note/);
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
await qualityRetryAudit();
await qualityHardStopAudit();
await shortWishAudit();
await responseCompatibilityAudit();
await wishReadinessAudit();
await freeFollowUpAudit();
await checkoutAudit();
await stripeCatalogAudit();
await webhookAudit();
await cancelKeeperAudit();
await adminSetupAudit();
await refundAudit();
await generationFailureRestoresCoinAudit();
await deleteSessionAudit();
await sqlAudit();
console.log(JSON.stringify({ ok: true, ...results }, null, 2));
