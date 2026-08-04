# August 4 audit summary

## Stripe and webhook

- Existing pack keys and environment variable names were preserved.
- Copper, moon, and monthly credits now have explicit mappings in `lib/commerce.js`.
- The webhook verifies the Stripe signature from the raw body.
- It retrieves the actual Stripe Checkout line item or subscription and rejects a mismatched Price ID.
- Event IDs are unique in `well_credit_events`, preventing duplicate grants.
- Webhook receipt/status is stored in `well_webhook_events` and visible in Admin.
- Checkout remains disabled unless Supabase, Stripe, the webhook secret, and all Price IDs are configured.

## Admin

- Allowed email: `altifygenerator@gmail.com`
- URL: `/admin.html`
- First setup requires a strong server-only `ADMIN_SETUP_TOKEN` and a chosen password.
- The account is created through Supabase Auth and marked as admin.
- The setup token can be removed after account creation.
- Admin can grant test copper or moon pennies, inspect balances, review webhook delivery, and verify Stripe catalog alignment.
- Private wish text is intentionally excluded from admin analytics.

## Coin types

- Daily: standard copper penny and standard response.
- Copper: orange/copper coin, Deep Water response, copper wallet.
- Moon: silver-blue glowing coin, crescent mark, Moon Water response, moon wallet.
- Well Keeper renewals deliver moon pennies.

## Important correction

The previous build changed premium styling but did not send the premium depth to OpenAI. The current build sends an explicit response mode and uses strict Structured Outputs, so Copper and Moon responses are now different at the AI layer as well as visually.
