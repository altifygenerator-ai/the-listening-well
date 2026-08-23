# Deploy Throw a Penny v1.7.2

This ZIP is intended to replace the current project source while preserving environment variables in Vercel.

## Before deploying

Keep the existing Vercel environment variables. Do not copy `.env.local` into Git.

For an existing database, make sure these migrations have already been run:

```text
supabase/migrations/20260804_coin_wallet_admin.sql
supabase/migrations/20260806_follow_up_echoes.sql
supabase/migrations/20260821_personal_readings.sql
```

There is no new SQL migration for v1.7.2.

## Deploy

```powershell
git add .
git status
git ls-files .env.local
git commit -m "Repair customer flow and production reliability"
git push
```

`git ls-files .env.local` must return nothing.

## After Vercel finishes

1. Open `https://throwapenny.com` in an incognito/private window.
2. Make one real test wish and confirm the generated response is specific to the wish.
3. In Stripe test mode, buy the Copper pack and confirm exactly 10 Copper pennies arrive.
4. Buy the Moon pack and confirm exactly 30 Moon pennies arrive.
5. Test Well Keeper and then use **Cancel Well Keeper** in the penny wallet.
6. In Stripe Workbench/Webhooks, confirm the deliveries to `https://throwapenny.com/api/stripe-webhook` return `2xx`.
7. Open `/admin.html` and confirm the integration/catalog panels are healthy.
8. Confirm Vercel Analytics is enabled in the Vercel project dashboard.

The Google verification tag, canonical domain, sitemap, robots file, Vercel analytics script, click tracking, Stripe product keys, webhook route, admin route, and Supabase integration remain in the codebase.


## v1.7.2 response fix

- Removed all normal canned/offline wish responses from the customer path.
- Missing or unavailable OpenAI now returns the penny instead of showing generic advice.
- Added a deterministic anti-generic guard after the AI quality review.
- Known canned phrases such as “a wish is often a direction before it is a destination” are explicitly rejected.
- Response headings now say “The well’s answer” / “Your follow-up answer” so the primary result is clearer.
- Service-worker cache bumped so existing installs receive this response fix.
