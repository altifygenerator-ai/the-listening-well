# Throw a Penny v1.8.0 verification report

## Automated project check

`npm run check` passes with:

- JavaScript syntax: 25 files
- Main UI DOM IDs: 133
- Admin DOM IDs: 23
- Existing response-mode, response-quality, coin restoration, checkout, webhook, subscription, admin, deletion, and free-follow-up checks retained

The checker intentionally exercises an unavailable fake OpenAI model during fallback testing, so `Wish generation failed on gpt-5: model_not_found` can appear in the test output while the final result is still `ok: true`.

## Additional v1.8 checks

- `node --check` passes for `public/app.js`, `api/events.js`, `api/wish.js`, `lib/well-core.js`, and `server.mjs`.
- HTML parses with 133 unique IDs and no duplicate IDs.
- The response screen contains exactly one carry/action card.
- Local `/api/config` reports version `1.8.0`.
- Local `/api/events` accepts the new route and degrades safely when Supabase is not configured.
- Home page serves the new `Your private 60-second Daily Echo` experience.
- First-use penny toss duration is 1.25s; returning Daily toss keeps the original 2.15s ritual, while existing paid follow-up timings remain distinct.
- Existing Stripe pack keys/prices and webhook mappings were not changed.
- Only `.env.example` is present; no local environment file was packaged.

## Production checks after deploy

1. Apply `supabase/migrations/20260830_daily_echo_analytics.sql`.
2. Confirm `/api/config` returns `"version":"1.8.0"`.
3. Complete a first Daily Echo and test Clarity/Calm/Courage/Let go/Focus choices.
4. Test **Hear your reflection** in Chrome/Safari/Edge and verify text remains usable if speech synthesis is unavailable.
5. Complete **I'll do this** and confirm ripples, quest progress, streak/listening days, and the later check-in appear.
6. Use **I just needed to hear this** and confirm it also completes the meaningful Daily Echo without creating an action check-in.
7. Submit Very/Somewhat/Not yet feedback.
8. Verify the existing one-free-follow-up path, Copper continuation, Moon continuation, and all three existing Stripe Checkout products.
9. Confirm `analytics_events` receives behavioral metadata but never private wish/answer/journal text.
10. Confirm clearing the device deletes the browser-linked Supabase profile and cascades its analytics rows.

Live OpenAI, Supabase, and Stripe credentials were not present in the supplied ZIP, so real production-provider calls cannot be verified locally. The existing project checker and local route checks passed without them.
