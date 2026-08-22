# Throw a Penny v1.5 — Response Quality + Conversion Pass

This build addresses the strongest launch feedback without changing the existing Stripe catalog, webhook products, admin authentication, coin balances, journal storage, sharing, SEO, or Vercel Analytics setup.

## What changed

### 1. Stronger AI response quality

The production prompt now makes specificity the core requirement. The model must silently identify the literal subject, desired outcome, supported tension, controllable vs. uncontrollable parts, and concrete details before writing.

The response must engage the actual subject immediately, stay mostly plainspoken, avoid fortune-cookie/therapy/manifestation clichés, and never invent motives or hidden relationship dynamics.

### 2. Automatic quality gate

After OpenAI generates the response, a second structured review scores:

- specificity
- directness
- grounding
- generic-response risk
- invented details

If the response fails, the app automatically regenerates it once using the editor's specific criticism. The user never sees the rejected draft.

`OPENAI_QUALITY_MODEL` is optional. If left blank, the same model configured in `OPENAI_MODEL` performs the review.

### 3. No canned fallback in production

When OpenAI is configured but unavailable, the server now restores the consumed penny and returns an error instead of silently substituting a canned local response. Local fallback remains available for development when no OpenAI key is configured.

### 4. One free follow-up before the paywall

A user who completes an ordinary daily wish now sees:

**Ask one follow-up free**

They can ask for clarity, a first action, help identifying what can be released, or write their own question. This continuation uses the original wish and original response as context.

With Supabase connected, the server verifies the original wish and allows one free follow-up total for the anonymous well session. It does not consume Daily, Copper, or Moon credits. After that proof-of-value moment, continuing an existing wish belongs to Copper or Moon.

After the free continuation, the next offer clearly explains:

- Copper = practical continuation
- Moon = deeper perspective shift

The existing Stripe products remain unchanged.

### 5. Lower follow-up friction

The first wish keeps the full slow penny ritual. The no-cost clarification goes directly into a short water-listening state instead of forcing another full toss.

Paid continuation still uses the coin ritual, but repeat tosses are shorter:

- Copper follow-up: ~1.1s toss
- Moon follow-up: ~1.6s toss
- Initial wish: ~2.15s toss

### 6. Cleaner first visit

Before the first wish:

- wallet/journal header controls are visually hidden
- the second cloud is removed
- the garden is subdued
- fewer stars/fireflies are generated
- the main composer remains the obvious focal point

After the first response, the existing journal and wallet controls return automatically.

No features were deleted.

### 7. Vague-wish nudge

Very short or extremely generic wishes are stopped before the penny is consumed. The user is asked for one concrete detail so the AI has enough information to produce a personal response.

## Stripe

No Stripe product names, pack keys, prices, webhook events, or credit grants were changed:

- `copper_10` — 10 Copper — $2.99
- `moon_30` — 30 Moon — $4.99
- `keeper_monthly` — 90 Moon/month — $4.99/month

## Supabase

No new database columns are required beyond the follow-up fields already introduced by:

`supabase/migrations/20260806_follow_up_echoes.sql`

If that migration has already been run, there is no new SQL to run for v1.5.

If it has not been run yet, run it once in the Supabase SQL Editor before deploying this build.

## Optional environment variable

```env
OPENAI_QUALITY_MODEL=
```

Leave it blank to use `OPENAI_MODEL` for both generation and review.

## Verification

`npm run check` now verifies:

- JavaScript syntax
- browser element references
- Stripe pack mappings
- Stripe webhook grants
- admin setup
- paid-credit restoration
- OpenAI structured responses
- OpenAI quality-review request
- automatic regeneration after a failed quality review
- FREE CLARIFICATION prompt mode
- one-free-follow-up server enforcement
- free follow-up does not consume a coin

