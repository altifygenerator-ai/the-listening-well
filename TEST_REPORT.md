# Deploy-ready verification report · v1.7.4

Verified August 23, 2026.

## Automated suite

Run:

```bash
npm run check
```

Current result:

```json
{
  "ok": true,
  "syntaxFiles": 24,
  "dom": {
    "indexIds": 105,
    "adminIds": 22
  }
}
```

The suite verifies JavaScript syntax, DOM references, Vercel routing, public-copy leak guards, PWA update behavior, Stripe pack mappings, Checkout metadata, raw-body webhook signatures, idempotent credit delivery, renewal credits, Well Keeper cancellation, safe cloud deletion, admin setup, coin restoration after failed persistence, one-time free follow-up enforcement, OpenAI structured output, response-quality rewriting, and required Supabase functions/migrations.

## Runtime smoke tests

The local Node server was started with no production credentials and verified:

- `/api/config` returns a safe public capability response.
- `/api/wish-check` handles a concrete wish.
- `/api/wish` completes the local-development flow.
- `/api/cancel-keeper` returns a customer-safe unavailable response when integrations are absent.
- `/api/delete-session` succeeds safely when no cloud database is configured.
- Unknown `/api/...` routes return JSON 404 rather than the homepage.
- `/`, `robots.txt`, and `sitemap.xml` serve correctly.

## Production-specific fixes included

- Stripe webhook verification reads the untouched raw request bytes before signature verification.
- OpenAI generation is bounded by timeouts and no longer chains repeated editor passes.
- A failed generated wish restores a consumed paid or daily penny.
- Stripe return handling detects credits that arrived before the customer returned from Checkout.
- Copper and Moon credits remain separate through Checkout, webhook delivery, storage, and UI.
- Daily-penny date handling matches the server's UTC date boundary.
- Stale client coin state is resynced after a server `NO_COIN` response.
- Clearing a browser-linked well does not erase the local identifier until cloud deletion is confirmed.
- Well Keeper can be canceled from the penny wallet without removing already delivered Moon pennies.
- Existing installed PWA sessions reload once when a new service worker takes control.
- Main HTML, JavaScript, CSS, and service-worker routes are set to revalidate instead of leaving customers on stale releases.
- Customer-facing pages avoid infrastructure/setup wording.

## What still requires a real deployed-account test

Automated tests cannot use the owner's live secrets. After deployment, complete one Stripe test-mode Copper purchase, one Moon purchase, and one Well Keeper signup/cancel cycle and confirm successful `2xx` webhook deliveries in Stripe. Also make one real OpenAI wish on the deployed domain. No live secret values are included in this project archive.
