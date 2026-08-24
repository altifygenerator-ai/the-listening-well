# Throw a Penny v1.7.5 deployment notes

This release repairs the wish-response pipeline after repeated "well went quiet" failures.

## What changed

- The normal wish path now starts with the smallest official Responses API request shape: model, instructions, input, token limit, and store=false.
- Strict Structured Outputs, reasoning-effort settings, and verbosity settings were removed from the customer wish path because they are not required to generate a response and were unnecessary failure points.
- If the configured model fails, the server can try `gpt-5-mini` and then `gpt-4.1-mini` as compatibility fallbacks. Optional environment overrides are `OPENAI_FALLBACK_MODEL` and `OPENAI_COMPAT_MODEL`.
- If a successful model response is not parseable as JSON, the same model gets one JSON-mode retry.
- Generic-response detection can request one rewrite, but a quality check is no longer allowed to turn a valid response into a broken experience.
- A Supabase/journal write failure after generation no longer discards the answer. The answer is returned to the browser and remains saved locally on that device.
- A true generation failure still restores any consumed Copper/Moon/daily penny.
- The admin OpenAI health check now runs the actual shared wish-generation function with `I wish I was taller`, so it tests the real production path rather than a separate toy request.
- Client/server/cache version bumped to `1.7.5`.

## Deploy

1. Replace the current project files with this release. Do not copy a local `.env.local` into Git.
2. Keep the existing Supabase, Stripe, admin, and OpenAI environment variables in Vercel.
3. Push to Git and let Vercel deploy.
4. Confirm `https://throwapenny.com/api/config` reports `"version":"1.7.5"`.
5. Sign into `/admin.html` and confirm the OpenAI diagnostic says the **real wish path verified** and shows a test answer.
6. Test a new free wish such as `I wish I was taller`.
7. Test one Copper continuation and one Moon continuation.

No new Supabase migration and no Stripe product/webhook changes are required for v1.7.5.
