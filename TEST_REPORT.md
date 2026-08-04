# Verification report

Audited on August 4, 2026.

## Automated checks passed

Run with:

```bash
npm run check
```

The current automated suite passed all of the following:

- Syntax validation for the local Node server, all API handlers, libraries, the main browser app, and the admin browser app
- No duplicate IDs in either main or admin HTML
- No missing HTML element targets referenced by the browser JavaScript
- Explicit Vercel routing for all six nested `/api/admin/...` URLs
- Exact pack map remains `copper_10`, `moon_30`, and `keeper_monthly`
- `copper_10` maps to 10 copper credits and one-time Checkout
- `moon_30` maps to 30 moon credits and one-time Checkout
- `keeper_monthly` maps to 90 moon credits and subscription Checkout
- Checkout passes the correct Price ID, pack key, coin type, and subscription metadata
- Moon wishes actually send `RESPONSE MODE: MOON WATER` to OpenAI
- OpenAI responses use strict JSON Schema Structured Outputs and `store: false`
- Webhook signature test with a raw request body
- Copper Checkout grants only copper credits
- Moon Checkout grants only moon credits
- Keeper Checkout and paid renewals grant moon credits
- Paid renewal handling routes through `invoice.paid`
- Webhook fulfillment records Stripe event IDs for idempotency
- A paid moon coin is automatically restored when a forced database persistence error occurs
- Admin first-time setup is locked to `altifygenerator@gmail.com`, confirms the account, assigns the admin role, signs it in, and sets an HttpOnly cookie
- New Supabase `sb_secret_...` and legacy `service_role` header behavior are both supported
- New and migration SQL both contain copper/moon wallets, refund RPC, subscription RPC, webhook audit RPC, and explicit service-role execution grants

## Manual/static audit fixes included

- Fixed the earlier premium-mode bug where the UI said Deep Water but the selected response mode was not passed to OpenAI
- Split the old single paid-credit balance into copper and moon wallets
- Migrated existing `paid` wish records to `copper` before adding the new database constraint
- Added different copper and moon coin visuals, well lighting, labels, response modes, and share-card treatment
- Fixed Vercel admin route destinations
- Added Stripe Price-object verification in Admin
- Added raw-body webhook signature verification and actual Price-ID matching before fulfillment
- Added `checkout.session.async_payment_succeeded` support
- Prevented initial subscription credits from being granted twice by both Checkout and the first invoice
- Added webhook and credit-delivery audit tables/views in Admin
- Added automatic paid-coin restoration after a post-consumption server failure
- Changed private cloud-state synchronization from a query-string session ID to a POST body
- Escaped dynamic Stripe/webhook/admin values before displaying them in the admin interface
- Removed the public Admin link from the customer-facing footer; the admin remains available directly at `/admin.html`

## Still requires real credentials

The code can simulate and validate request routing, signatures, mappings, and failure behavior, but these items must be completed against the real accounts:

- Run the SQL schema or migration in the actual Supabase project
- Create the actual Supabase Auth admin password for `altifygenerator@gmail.com`
- Verify all three real Stripe test Price IDs in the Admin catalog panel
- Complete all three actual Stripe test Checkouts
- Confirm the deployed Stripe endpoint receives signed events and returns HTTP 200
- Test a real subscription renewal/cancellation in Stripe test mode
- Make real OpenAI moderation and Responses API calls

Use `WEBHOOK_ADMIN_SETUP.md` for the exact procedure.
