# Throw a Penny v1.7.4 deployment notes

This release fixes the response path that could reject short, valid wishes such as “I wish I was taller.”

## What changed

- Short wishes no longer fail because the answer used a natural synonym. Example: `taller` may correctly be answered using `height`.
- The pre-toss specificity check is now local and instant. It no longer makes an extra OpenAI request before the real wish.
- Normal wishes use one OpenAI generation. A second OpenAI call happens only when the first draft is clearly generic/canned.
- The main prompt explicitly tells the model not to invent a deep hidden meaning for simple wishes.
- The prompt includes a height example so physical-trait wishes are answered directly without pretending to know age or growth stage.
- The structured-output nullable field uses the current `type: ["string", "null"]` form.
- GPT-5 reasoning effort is set to `minimal` to reduce response latency.
- Admin now performs a real, tiny OpenAI response probe and shows whether the configured model can actually answer. This catches invalid keys, missing API billing/quota, model-access errors, and timeouts instead of merely checking whether a key string exists.
- Client/server version is now `1.7.4` and the existing stale-build protection remains in place.

## After deployment

1. Deploy the new files and wait for Vercel to finish.
2. Open `https://throwapenny.com/api/config` and confirm `"version":"1.7.4"`.
3. Open `/admin.html`, sign in, and check the OpenAI line. It must say the configured model connection was verified.
4. If OpenAI shows `insufficient_quota`, `invalid_api_key`, `model_not_found`, or another error, fix that API account/configuration issue before testing wishes again.
5. Test `I wish I was taller`. It should go straight to the toss and return a direct answer about height rather than generic wishing-well philosophy.

No Stripe or Supabase changes are required for this release.
