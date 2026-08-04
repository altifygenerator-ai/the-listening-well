# Supabase, Stripe Webhook, and Admin Setup

Complete these steps in order. Use Stripe test mode until all checks pass.

## 1. Supabase database

### New Supabase project

Open **SQL Editor**, paste the complete contents of:

```text
supabase/schema.sql
```

Run it once.

### Existing Listening Well Supabase project

Run this instead:

```text
supabase/migrations/20260804_coin_wallet_admin.sql
```

The migration moves old `paid_credits` balances into the copper wallet, adds the moon wallet, creates the webhook audit table, and installs the updated RPC functions.

Confirm these tables exist:

- `well_profiles`
- `wishes`
- `monthly_reflections`
- `well_credit_events`
- `well_webhook_events`

## 2. Supabase environment variables

Copy the project URL and a server-side secret key into Vercel or `.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

A legacy server key also works:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Use the secret key only on the server. Do not place it in `public/`, frontend JavaScript, or Git.

## 3. Admin setup

Add:

```env
ADMIN_EMAILS=altifygenerator@gmail.com
ADMIN_SETUP_TOKEN=PASTE_A_LONG_RANDOM_VALUE
```

Generate a setup token locally with either:

```bash
openssl rand -hex 32
```

or:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Deploy or redeploy, then visit:

```text
https://YOUR_DOMAIN/admin.html
```

Open **First-time admin setup** and enter:

- Email: `altifygenerator@gmail.com`
- The `ADMIN_SETUP_TOKEN`
- A new password of at least 12 characters

This creates or resets the allowlisted Supabase Auth account and signs it in. After setup succeeds, remove `ADMIN_SETUP_TOKEN` from production and redeploy. Login continues working. Temporarily add a new setup token later only when the password must be reset.

The actual account cannot be created until the deployed server has working Supabase credentials and you choose its password.

## 4. Stripe products and prices

In the Stripe **test environment**, create or confirm these prices:

| App pack | Stripe price | Billing | Credits delivered |
|---|---:|---|---:|
| 10 Copper Pennies | $2.99 USD | One-time | 10 copper |
| 30 Moon Pennies | $4.99 USD | One-time | 30 moon |
| Well Keeper | $4.99 USD | Monthly recurring | 90 moon each paid month |

Add the test values:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_COPPER_10=price_...
STRIPE_PRICE_MOON_30=price_...
STRIPE_PRICE_KEEPER_MONTHLY=price_...
APP_URL=https://YOUR_DOMAIN
```

The admin panel calls Stripe from the server and checks all three configured Price objects. **Stripe catalog matches** turns green only when the prices are active and match the amounts and billing cadence shown above.

## 5. Create the Stripe webhook

After the site is deployed to HTTPS, create a webhook/event destination in the same Stripe mode as your keys and prices.

Endpoint URL:

```text
https://YOUR_DOMAIN/api/stripe-webhook
```

Subscribe to these events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
invoice.paid
invoice.payment_failed
customer.subscription.updated
customer.subscription.deleted
```

Copy the endpoint signing secret and add:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Redeploy after adding it.

Important:

- A test-mode webhook secret is different from a live-mode webhook secret.
- A Stripe CLI forwarding secret is different from the Dashboard endpoint secret.
- The code requires the unmodified raw request body for signature verification.
- The webhook looks up the actual Checkout/subscription Price ID; metadata alone cannot grant credits.

## 6. Optional local webhook testing with Stripe CLI

Start the app:

```bash
node --env-file=.env server.mjs
```

In another terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

The CLI prints a temporary `whsec_...`. Use that value locally as `STRIPE_WEBHOOK_SECRET` while forwarding. Restore the Dashboard endpoint secret in Vercel for the deployed site.

A generic `stripe trigger checkout.session.completed` event will not contain the Listening Well session and price metadata needed to grant credits. The most reliable test is completing each actual test-mode Checkout from the site.

## 7. End-to-end test checklist

Open the main well once in the same browser so it creates a session. Then open `/admin.html`.

### Connection check

Every required light should be green:

- Supabase
- Stripe key
- Webhook secret
- Copper price
- Moon price
- Keeper price
- Stripe catalog matches
- OpenAI, when the AI key has been added

### Admin credit test

Use **+10 copper** and **+10 moon** under **Test this device**.

Return to the main site and refresh. Confirm:

- Copper and moon balances are separate
- Copper appears warm orange/copper
- Moon appears silver-blue with a crescent
- The chooser lets you select the exact available coin
- Copper returns a Deep Water response
- Moon returns a Moon Water response

### Copper Checkout

1. Buy `10 copper pennies`.
2. Complete Stripe test Checkout.
3. Confirm the browser reports 10 copper pennies.
4. Confirm Admin shows a processed `checkout.session.completed` event.
5. Confirm **Credit deliveries** shows `10 copper pennies` with pack `copper_10`.
6. Confirm no moon credits changed.

### Moon Checkout

Repeat for `30 moon pennies` and confirm only the moon balance increases by 30.

### Well Keeper

1. Start the monthly subscription.
2. Confirm Checkout grants 90 moon pennies once.
3. Confirm the initial `invoice.paid` event is recorded but does not duplicate the initial 90 credits.
4. Use Stripe test clocks or the Dashboard to test a later successful renewal.
5. Confirm the renewal `invoice.paid` grants another 90 moon pennies.
6. Cancel the subscription and confirm `customer.subscription.deleted` sets Keeper inactive without removing previously purchased credits.

### Failure checks

- Send or resend a webhook event: credits must not duplicate because Stripe event IDs are unique.
- Temporarily use a mismatched Price ID: the webhook must fail instead of granting the wrong pack.
- Check a failed webhook in Admin; its error appears under **Webhook events**.
- Confirm a wish-processing/database failure restores the selected paid penny.

## 8. Switch to live Stripe mode

Test and live Stripe objects are separate. When all test-mode checks pass:

1. Create or confirm the three live Price objects.
2. Replace `sk_test_...` with the live secret key.
3. Replace all three test `price_...` IDs with live Price IDs.
4. Create a live webhook endpoint using the same URL and event list.
5. Replace the test `whsec_...` with the live endpoint secret.
6. Redeploy.
7. Open Admin and verify every light plus **Stripe catalog matches**.
8. Complete one small real purchase before announcing the site.

## Complete environment example

```env
PORT=3000
APP_URL=https://YOUR_DOMAIN

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

STRIPE_SECRET_KEY=sk_test_or_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_COPPER_10=price_...
STRIPE_PRICE_MOON_30=price_...
STRIPE_PRICE_KEEPER_MONTHLY=price_...

ADMIN_EMAILS=altifygenerator@gmail.com
ADMIN_SETUP_TOKEN=
```
