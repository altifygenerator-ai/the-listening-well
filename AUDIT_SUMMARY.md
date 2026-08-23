# Throw a Penny v1.7.3 audit summary

This release is based on the uploaded production project and focuses on customer-visible reliability rather than adding more features.

## Fixed reliability issues

- Stripe webhook signature verification now preserves the exact signed request body on Vercel.
- The wish pipeline now uses one generation, one quality review, and at most one focused rewrite instead of repeated model calls that could turn a good wish into a timeout.
- OpenAI failures in production do not silently show canned development responses.
- Consumed pennies are restored when generation or persistence fails.
- Daily-penny state uses the same UTC day boundary as Supabase and automatically resyncs stale browser state.
- Payment returns recognize credits delivered while the customer was still on Stripe Checkout.
- Old browser/session data is repaired where possible instead of repeatedly breaking the experience.
- Journal deletion fails safely if cloud deletion cannot be confirmed.
- Well Keeper cancellation is available directly from the penny wallet.
- PWA updates now actively replace stale releases for already-installed users.

## Customer-facing cleanup

- Public metadata and visible copy describe the wishing-well experience rather than the implementation stack.
- Setup/database/webhook language is kept out of the customer experience.
- Payment and failure messages are written as normal customer messages.
- Privacy and Terms pages accurately describe browser-linked journals, third-party response processing, sharing, Stripe payments, analytics, and Well Keeper cancellation.
- Admin remains private, unlinked from the customer footer, and marked `noindex,nofollow,noarchive`.

## Preserved integrations

- `throwapenny.com` canonical/SEO metadata and Google verification.
- Vercel Web Analytics loader and privacy-safe custom event calls.
- Existing Stripe product keys and prices.
- Existing Supabase schema/migrations and anonymous journal model.
- Copper and Moon wallets, share cards, sealed wishes, monthly echoes, admin tools, and refined OpenAI prompt.
