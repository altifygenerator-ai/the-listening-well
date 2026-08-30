# Throw a Penny · The Listening Well

A mobile-first digital wishing well built around one simple ritual: write one honest wish, toss a penny, and get a response that is specific enough to feel worth reading.

The product deliberately keeps the first visit simple. The journal, sealed wishes, monthly echoes, paid pennies, sharing, Stripe, Supabase, analytics, and admin tools remain underneath the experience instead of competing with the first toss.

## Product flow

1. Write a private wish.
2. Short or vague wishes may get one optional clarification question before a penny is used.
3. Toss the free daily penny.
4. Receive a direct, wish-specific response, one interpretation, and one useful next move.
5. The first continuation in a well is free once, so a new user can see that the well can carry the same wish forward.
6. After that proof-of-value moment, Copper and Moon pennies continue wishes the user actually cares about.

## Why the paid pennies are different

- **Daily penny** — a complete first response, free once each day.
- **Copper penny** — practical continuation of an existing wish: clarify a decision, identify a concrete next move, or work through one specific question.
- **Moon penny** — a fuller reading with a different perspective, a private Moon note worth saving, and Moon-specific visual/share treatment.

Existing Stripe products are unchanged:

- `copper_10` — 10 Copper continuations for $2.99
- `moon_30` — 30 Moon readings for $4.99
- `keeper_monthly` — 90 Moon pennies each month for $4.99/month

## Response-quality pipeline

Production responses are not accepted just because the model returned valid JSON.

- The prompt extracts the literal subject, desired outcome, supported tension, and concrete details before answering.
- Generic mystical filler and unsupported assumptions are explicitly prohibited.
- The structured response is checked locally for retired canned phrases, generic openings, and loss of connection to the actual wish.
- A clearly bad first draft gets one focused rewrite, but normal wishes do not pay the latency/reliability cost of a second editor-model call.
- Short, specific wishes are allowed to use natural synonyms, so a wish such as “I wish I was taller” can be answered using words like “height” without being falsely rejected.
- If the rewrite still fails the anti-generic guard, the penny is returned instead of showing a bad answer.
- If OpenAI is unavailable, the app returns the penny rather than presenting a canned fallback as a real reading.

## Run locally

Node 20 or newer is required.

```bash
npm install
cp .env.example .env
node --env-file=.env server.mjs
```

Or:

```bash
npm run dev
```

Open `http://localhost:3000`.

Without an OpenAI key, the interface, animation, journal, share cards, and other local UI can still be tested, but wishes intentionally do not generate fake fallback answers. Add `OPENAI_API_KEY` to test the real response flow.

## Validate the project

```bash
npm run check
```

The project check covers JavaScript syntax, DOM references, Vercel admin routes, coin mappings, response modes, response-quality retry behavior, Stripe Checkout metadata, raw-body webhook fulfillment, subscription renewals and cancellation, safe cloud deletion, free-follow-up enforcement, Supabase functions, and penny restoration when response generation itself fails, plus cloud-save resilience after a valid answer exists.

## Supabase

For a new project, run:

```text
supabase/schema.sql
```

For an existing Listening Well database, apply the migrations in order as needed:

```text
supabase/migrations/20260804_coin_wallet_admin.sql
supabase/migrations/20260806_follow_up_echoes.sql
supabase/migrations/20260821_personal_readings.sql
```

The August 21 migration adds storage for the optional clarification detail and private Moon note.

## Important files

```text
public/index.html                         Main product interface
public/styles.css                        Scene, responsive UI, Copper/Moon treatments
public/app.js                            Ritual, wallets, follow-ups, journal, sharing, analytics
api/wish-check.js                        Optional pre-toss specificity check
api/wish.js                              Safety, coin use, AI generation, persistence
lib/well-core.js                         Main AI prompt, structured output, anti-generic guard
lib/commerce.js                          Stripe pack source of truth
api/checkout.js                         Stripe-hosted Checkout
api/cancel-keeper.js                    Customer-initiated Well Keeper cancellation
api/stripe-webhook.js                    Signed/idempotent fulfillment
public/admin.html                        Private admin interface
supabase/schema.sql                      Complete new-project database
WEBHOOK_ADMIN_SETUP.md                   Setup/testing guide
```

## Payments and privacy

- Checkout stays disabled until both Stripe and Supabase are configured.
- Stripe webhook signatures are verified against the raw request body.
- Actual Stripe Price IDs are verified before credits are granted.
- Stripe event IDs are stored to prevent duplicate fulfillment.
- Well Keeper can be canceled from the penny wallet; future renewals stop while existing pennies remain.
- Copper and Moon balances are separate.
- A consumed penny is restored if response generation fails before a valid answer is delivered. If cloud journal saving fails after a valid answer exists, the answer still returns and remains in the browser journal instead of being discarded.
- Private wish text is not included in public share cards or analytics events.
- Clearing the browser-linked well only removes local state after cloud deletion is confirmed.
- There is currently no customer login. Paid pennies and journal recovery are tied to the anonymous browser session; do not imply cross-device recovery until account recovery is added.

## Admin

The configured admin allowlist can include:

```text
altifygenerator@gmail.com
```

See `WEBHOOK_ADMIN_SETUP.md` for first-time admin creation, Stripe testing, webhook verification, and manual Copper/Moon grants.

## v1.7.4 response repair

The current build includes a client/server version handshake, retired-response filtering, versioned assets, and a stricter direct-answer prompt so old canned responses cannot silently reappear.

## v1.7.5 response reliability repair

The customer wish path now prioritizes reliability over strict output machinery. It uses the basic Responses API shape first, has compatibility model fallbacks, never discards a valid answer because cloud storage failed afterward, and restores a consumed penny when generation itself truly fails. The admin OpenAI diagnostic exercises the same shared wish-generation path used by customers.


## v1.8.0 Daily Echo retention rebuild

The home experience now centers on a 60-second Daily Echo, with need chips, browser listening playback, a tiny action commitment, visible ripples/streak/3-day quest progress, return check-ins, helpfulness feedback, and an earlier non-blocking premium preview. Durable privacy-safe funnel events can be stored in Supabase after running `supabase/migrations/20260830_daily_echo_analytics.sql`. Existing Stripe products and prices are unchanged. See `DAILY_ECHO_RETENTION_UPDATE_V1_8.md`.
