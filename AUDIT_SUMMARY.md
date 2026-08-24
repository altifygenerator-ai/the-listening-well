# Throw a Penny v1.7.5 audit summary

The repeated customer-facing `went quiet` state had two possible sources hidden behind the same error: model generation and cloud persistence. v1.7.5 separates them.

A generated answer is now treated as the product outcome. Once it exists, a later Supabase write problem cannot throw it away. Cloud persistence is best-effort after generation while the browser journal remains the immediate local copy.

The OpenAI request path was simplified to the basic Responses API request first. The app retains a parse-recovery path plus model fallbacks, but avoids mandatory schema/reasoning/verbosity options on every wish.

Automated checks cover syntax, DOM references, pricing mappings, Stripe webhooks, credit delivery, admin auth, wish readiness, short wishes, generic-response rewrite behavior, model fallback behavior, JSON parse recovery, generation-failure penny restoration, and cloud-save failure resilience.
