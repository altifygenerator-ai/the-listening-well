-- Adds optional metadata for paid follow-up echoes.
-- Safe to run on an existing Listening Well database.

alter table public.wishes
  add column if not exists response_kind text not null default 'wish';

alter table public.wishes
  add column if not exists parent_wish_id uuid references public.wishes(id) on delete set null;

alter table public.wishes
  add column if not exists follow_up_prompt text;

alter table public.wishes
  add column if not exists follow_up_direction text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wishes_response_kind_check'
      and conrelid = 'public.wishes'::regclass
  ) then
    alter table public.wishes
      add constraint wishes_response_kind_check
      check (response_kind in ('wish','follow_up'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'wishes_follow_up_direction_check'
      and conrelid = 'public.wishes'::regclass
  ) then
    alter table public.wishes
      add constraint wishes_follow_up_direction_check
      check (follow_up_direction is null or follow_up_direction in ('clarity','action','release','custom'));
  end if;
end $$;

create index if not exists wishes_parent_idx
  on public.wishes(parent_wish_id, created_at asc)
  where parent_wish_id is not null;
