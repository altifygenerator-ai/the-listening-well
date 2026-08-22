# Throw a Penny v1.6 · Human Product Pass

This pass was built around real tester objections rather than adding more features.

## Problems addressed

### “The answer was nonsense / crude / ChatGPT wisdom”
- Reworked the well prompt around the literal situation instead of generic emotional themes.
- The first sentence must address the actual wish rather than opening with a metaphor.
- Responses may not invent motives, relationship dynamics, diagnoses, or other facts.
- Lighthearted wishes stay lighthearted instead of being forced into a life lesson.
- Added a strict second-model quality review.
- Weak drafts regenerate once from the editor's exact critique and the retry is reviewed too.
- If both drafts still fail the specificity gate, the app refuses to show the weak answer and returns the penny instead.
- Production AI failures return the penny instead of substituting generic fallback copy.

### “My wish was too vague to get anything useful”
- Short/borderline wishes can get one optional clarification question before the penny is spent.
- The question asks only for the single detail that would materially improve the answer.
- Specific wishes skip this step and go straight to the penny so the ritual stays quick.

### “Why would I pay for another response?”
- A new well gets one free continuation total so the user can verify that the product remembers and understands the same wish.
- The free daily penny remains daily, but unlimited free continuations are gone.
- Copper is now positioned as practical continuation, not “more tokens.”
- Moon is a different experience: fuller perspective shift, private Moon note, distinct visuals/share card.
- Paid continuation resumes automatically after Stripe returns instead of making the user repeat steps.
- Paid follow-ups auto-drop the selected coin; only the first wish keeps the full tap/flick ritual.

### “There is too much going on”
- First-visit visual noise was reduced.
- Paid choices and secondary controls are progressively disclosed.
- The response card emphasizes the answer, one action, and the single next decision.
- Journal, sealing, sharing, wallet, monthly echoes, and installation remain available without being explained up front.
- Brand/share treatment now consistently leads with “Throw a Penny.”

## No payment changes

Stripe keys, pack IDs, amounts, and webhook mappings remain unchanged:

- Copper 10: $2.99
- Moon 30: $4.99
- Well Keeper: $4.99/month for 90 Moon pennies

## Database update

Run once on an existing database:

```text
supabase/migrations/20260821_personal_readings.sql
```

It adds:

```text
clarification_text
moon_note
```

The API includes backward-compatible persistence fallback while the migration is pending, but applying it is recommended before launch.

## Important current limitation

Regular customer accounts are still intentionally not part of this pass. Paid pennies and journal recovery are attached to the anonymous browser session. The UI and Terms now avoid implying cross-device recovery. Adding optional account/recovery should be a separate product decision rather than being forced into the first ritual.

## Deployment check

Before committing:

```powershell
git ls-files .env.local
```

It must return nothing.

Then:

```powershell
git add .
git status
git commit -m "Refine wish quality and paid continuation flow"
git push
```

After deploy, test one vague wish, one specific wish, the one-time free follow-up, Copper continuation, Moon continuation, and all three Stripe checkout products in test mode.
