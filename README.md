# The Listening Well

A mobile-first animated AI wishing well with three distinct coin experiences, a private wish journal, share cards, habit-forming return loops, Supabase storage, Stripe Checkout, signed webhook fulfillment, and a secure testing/admin panel.

## Coin experiences

- **Daily penny** — one complete standard echo each day.
- **Copper penny** — warm copper styling and a longer **Deep Water** response.
- **Moon penny** — silver-blue coin, moonlit well effects, and the most detailed **Moon Water** response.

The existing Stripe pack keys remain:

- `copper_10` — 10 copper pennies for $2.99
- `moon_30` — 30 moon pennies for $4.99
- `keeper_monthly` — 90 moon pennies each month for $4.99/month

## Run locally

Node 20 or newer is required. There are no runtime package dependencies.

```bash
cp .env.example .env
node --env-file=.env server.mjs
```

Open `http://localhost:3000`.

Without credentials, the animation, local journal, fallback responses, share cards, and habit layer still work. Checkout remains disabled until Supabase and Stripe are both ready.

## Validate the project

```bash
npm run check
```

The check covers JavaScript syntax, HTML element references, Vercel admin routes, coin-pack mappings, OpenAI response modes, Stripe Checkout metadata, webhook credit routing, subscription renewals, and paid-penny restoration after a failed database write.

## Connect services

Follow [WEBHOOK_ADMIN_SETUP.md](WEBHOOK_ADMIN_SETUP.md) for the exact order.

At a high level:

1. Run `supabase/schema.sql` for a new project, or the included migration for an older Listening Well database.
2. Add Supabase server credentials.
3. Add the Stripe test key and all three test-mode price IDs.
4. Deploy to a public HTTPS URL.
5. create the Stripe webhook and add its `whsec_...` signing secret.
6. Create the testing admin account at `/admin.html`.
7. Verify every admin connection light and the Stripe catalog alignment panel.

## Admin account

The default allowed admin email is:

```text
altifygenerator@gmail.com
```

The project does not contain or invent an admin password. After Supabase is connected, set a strong `ADMIN_SETUP_TOKEN`, deploy, open `/admin.html`, and use **First-time admin setup** to choose the password. The setup route creates or resets only an allowlisted email and stores the account through Supabase Auth.

The admin panel can:

- Confirm Supabase, OpenAI, Stripe key, webhook secret, and all price IDs are present
- Query Stripe and verify that the three configured prices match the displayed amounts and billing cadence
- Show received, processed, ignored, and failed webhook events
- Show every credit delivery and its coin type
- Grant copper or moon test pennies to a browser session
- Show aggregate usage without exposing private wish text

## Important files

```text
public/index.html                         Product interface
public/styles.css                        Well scene, animations, copper/moon treatments
public/app.js                            Wallets, coin selection, tossing, journal, sharing
public/admin.html                        Private admin interface
public/admin.js                          Admin testing and monitoring
lib/well-core.js                         AI prompt, Structured Outputs, safety, Supabase helpers
lib/commerce.js                          Single source of truth for Stripe pack mappings
lib/admin-auth.js                        Allowlist, Supabase Auth, secure admin cookie
api/checkout.js                          Stripe-hosted Checkout creation
api/stripe-webhook.js                    Signature verification and idempotent fulfillment
api/admin-dashboard.js                   Health, catalog, webhook, and credit audit data
supabase/schema.sql                      Complete new-project database
supabase/migrations/20260804_coin_wallet_admin.sql
                                        Upgrade from the earlier single paid-credit wallet
WEBHOOK_ADMIN_SETUP.md                   Exact setup and testing guide
```

## Payment safeguards

- Checkout is unavailable until both Stripe and Supabase are configured.
- The webhook verifies the signature against the raw request body.
- Fulfillment verifies the actual Stripe line-item price against the configured price ID.
- Stripe event IDs are stored uniquely so the same event cannot grant credits twice.
- Copper, moon, and subscription credits are stored separately.
- A paid penny is restored automatically if the server consumes it but cannot save the completed wish.
- Private Stripe and Supabase credentials remain server-side.

## Before a public launch

- Complete all test-mode purchases and webhook tests in `WEBHOOK_ADMIN_SETUP.md`.
- Replace the draft Privacy and Terms pages with business-specific reviewed policies.
- Add durable distributed rate limiting and bot protection.
- Decide and document wish retention and deletion periods.
- Test on low-power Android phones, iPhone Safari, reduced-motion mode, VoiceOver, and TalkBack.
- Keep Supabase secret keys, Stripe secret keys, webhook secrets, OpenAI keys, and the admin setup token out of Git and browser code.

## Simplified paid continuation flow

The free daily wish remains complete. After a response, Copper and Moon pennies can now continue that same wish through a guided follow-up echo. See `SIMPLIFICATION_FOLLOWUP_UPDATE.md` and run `supabase/migrations/20260806_follow_up_echoes.sql` to preserve full parent/follow-up metadata in Supabase. The server remains backward-compatible with the previous wish table while the migration is pending.


## v1.5 response-quality and conversion pass

See `RESPONSE_QUALITY_CONVERSION_UPDATE.md` for the free clarification flow, automatic AI quality gate, production fallback protection, and simplified first-visit UI.
