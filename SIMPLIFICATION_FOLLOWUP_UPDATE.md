# Simplification and Follow-up Echo Update

This update keeps the existing Stripe packs, webhook fulfillment, Supabase session storage, admin panel, journal, sharing, SEO, and analytics intact. It changes the presentation and paid experience so the core ritual is easier to understand and paid pennies do more than repeat the free wish.

## What changed

### Cleaner first visit

- The opening screen centers on one action: type a private wish and toss the free daily penny.
- New visitors are not asked to compare three coin types before they understand the experience.
- Copper and Moon selection is collapsed under **Use a different penny** and becomes relevant when the visitor owns paid credits.
- Installation, journal, wallet, and advanced controls remain available but no longer compete with the wish ritual.

### Cleaner response screen

- The well's answer is the visual focus.
- The interpretation is available under **Why this wish may matter**.
- The primary paid action is now **Go deeper into this wish**.
- Save/seal and share remain easy to reach, while invitations and starting over are grouped under **More from the well**.

### Paid follow-up echoes

Copper and Moon pennies can continue the wish already on screen instead of only starting another unrelated wish.

Available directions:

- Give me clarity
- Help me take action
- Help me let this go
- Ask my own question

Copper is positioned as a practical guided follow-up. Moon is positioned as the premium, deeper perspective. Existing Stripe products and credit quantities are unchanged:

- `copper_10`: 10 Copper pennies for $2.99
- `moon_30`: 30 Moon pennies for $4.99
- `keeper_monthly`: 90 Moon pennies for $4.99/month

### More personal AI prompt

The well now has explicit specificity requirements:

- Identify the exact subject, desired change, emotional stake, and controllable part.
- Anchor the answer to at least two concrete details or tensions from the wish or saved context.
- Avoid language that could fit an unrelated wish.
- Avoid invented motives, diagnoses, history, and vague inspirational filler.
- Answer paid follow-up questions directly before adding imagery.
- Use recent saved wishes only when there is a genuinely supported recurring pattern.

The prompt still prohibits fortune-telling claims, guarantees, harmful advice, dependency, and reinforcement of paranoia or delusions.

## Optional Supabase migration

The app includes a compatibility fallback, so follow-up responses still save on the older database schema. To retain full follow-up metadata in Supabase, run this file once in the Supabase SQL Editor:

```text
supabase/migrations/20260806_follow_up_echoes.sql
```

It adds:

- `response_kind`
- `parent_wish_id`
- `follow_up_prompt`
- `follow_up_direction`

The migration uses `if not exists` and preserves existing wishes.

## Analytics added

No wish text or private journal content is sent. New events include:

- `deep_echo_offer_viewed`
- `deep_echo_offer_clicked`
- `follow_up_direction_selected`
- `follow_up_purchase_needed`
- `paid_follow_up_ready`
- `paid_follow_up_completed`
- `follow_up_resumed`
- `response_meaning_opened`
- `response_more_opened`
- `coin_choices_toggled`

## Deployment

Copy the updated files over the existing project, then run:

```powershell
git add .
git commit -m "Simplify wish flow and add personal follow-up echoes"
git push
```

The updated `.gitignore` excludes `.env.local` and other environment files. Before committing, verify:

```powershell
git status
git ls-files .env.local
```

`git ls-files .env.local` must return nothing.
