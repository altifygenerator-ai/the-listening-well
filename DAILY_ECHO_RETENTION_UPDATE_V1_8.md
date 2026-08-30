# Throw a Penny v1.8.0 · Daily Echo retention rebuild

This build turns the one-off wishing-well interaction into a repeatable Daily Echo loop while preserving the existing OpenAI, Supabase, Stripe, moderation, payment products, coin balances, and follow-up behavior.

## Product changes
- Need-first onboarding: Clarity, Calm, Courage, Let go, Focus, or Something else.
- First-session CTA now frames the experience as a private 60-second Daily Echo.
- First successful penny ritual is shortened to reduce time-to-value. Returning rituals keep more atmosphere.
- Browser speech synthesis adds a real **Hear your reflection** mode without adding another AI/audio vendor. Text remains the fallback.
- Every reflection ends in **One thing for today**, with **I’ll do this** or **I just needed to hear this**.
- Meaningful completion earns ripples, advances the visible 3-day quest, and updates a forgiving ripple streak plus 7-day listening count.
- A later-day check-in closes the loop on a committed next step.
- Helpful/Somewhat/Not yet feedback creates a response-quality signal.
- A non-blocking premium preview appears after value is completed so paid value is visible before the old follow-up bottleneck.
- Existing Copper 10 ($2.99), Moon 30 ($4.99), and Well Keeper ($4.99/mo) Stripe products are unchanged.

## Analytics / observability
- Added privacy-safe durable event batching through `/api/events`.
- Events deliberately reject property names that could contain wish, answer, journal, prompt, message, or text content.
- Added `session_started`, input, submit, API latency/failure, reflection, listening, action, quest, streak, feedback, paywall, and checkout funnel signals.
- Vercel Analytics remains in place as a secondary traffic/event layer.
- If the analytics migration is not yet applied, the app still works normally and the endpoint degrades safely.

## Supabase
Run once on an existing database:

`supabase/migrations/20260830_daily_echo_analytics.sql`

This creates `analytics_events` only. No Stripe migration and no change to existing wish/credit tables is required.

## Important scope choice
The research recommended contextual push reminders, optional account recovery, annual membership tests, and later multi-week Journeys. Those require either notification infrastructure, auth/recovery work, or new Stripe prices. This pass does not pretend those systems exist. It builds the measurable habit loop first, using the APIs and payment catalog already in the product.
