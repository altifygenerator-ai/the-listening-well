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
- A separate model pass grades specificity, directness, grounding, usefulness, generic risk, and invented details.
- A weak first draft is regenerated from the editor critique and reviewed again.
- If OpenAI is unavailable in production, the app returns the penny rather than presenting a canned fallback as a real reading.

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

Without credentials, local development still supports the animation, journal, deterministic fallback responses, share cards, and habit layer. Production should have OpenAI configured before launch.

## Validate the project

```bash
npm run check
```

The project check covers JavaScript syntax, DOM references, Vercel admin routes, coin mappings, response modes, response-quality retry behavior, Stripe Checkout metadata, webhook fulfillment, subscription renewals, free-follow-up enforcement, Supabase functions, and paid-penny restoration after a failed write.

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
lib/well-core.js                         Main AI prompt, structured output, quality gate
lib/commerce.js                          Stripe pack source of truth
api/checkout.js                          Stripe-hosted Checkout
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
- Copper and Moon balances are separate.
- A paid penny is restored if it is consumed but the completed wish cannot be saved.
- Private wish text is not included in public share cards or analytics events.
- There is currently no customer login. Paid pennies and journal recovery are tied to the anonymous browser session; do not imply cross-device recovery until account recovery is added.

## Admin

The configured admin allowlist can include:

```text
altifygenerator@gmail.com
```

See `WEBHOOK_ADMIN_SETUP.md` for first-time admin creation, Stripe testing, webhook verification, and manual Copper/Moon grants.
