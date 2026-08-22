-- v1.6: preserve the optional detail used to personalize a wish and the extra Moon Water note.
-- Safe to run on an existing Listening Well database.

alter table public.wishes
  add column if not exists clarification_text text;

alter table public.wishes
  add column if not exists moon_note text;
