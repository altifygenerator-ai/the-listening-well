# Throw a Penny v1.7.5 verification report

Automated project check passes with:

- 24 JavaScript files syntax checked
- 105 homepage DOM references checked
- 23 admin DOM references checked
- Copper, Moon, and Well Keeper mappings verified
- Stripe webhook and duplicate-event handling verified with mocks
- Short-wish regression: `I wish I was taller`
- Configured-model failure -> fallback-model path verified
- Non-JSON model output -> JSON-mode retry verified
- Weak first response -> one rewrite verified
- Cloud persistence failure -> answer still returned verified
- Model generation failure -> consumed penny restored verified
- Free follow-up limits verified
- Supabase migration/function checks verified

A live OpenAI/Stripe/Supabase transaction cannot be performed without the deployed account credentials. The admin dashboard now tests the same OpenAI wish-generation function used by customers so the live environment can be verified immediately after deployment.
