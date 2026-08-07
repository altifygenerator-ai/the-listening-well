-- The Listening Well database schema
-- Run this once in the Supabase SQL editor for a new project.
-- For an existing project created with an older build, run migrations/20260804_coin_wallet_admin.sql instead.
-- All browser writes go through the server using the secret/service-role key.

create extension if not exists pgcrypto;

create table if not exists public.well_profiles (
  session_id uuid primary key,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  daily_claim_date date,
  copper_credits integer not null default 0 check (copper_credits >= 0),
  moon_credits integer not null default 0 check (moon_credits >= 0),
  -- Kept only so older deployments can migrate safely. New code does not use it.
  paid_credits integer not null default 0 check (paid_credits >= 0),
  subscription_active boolean not null default false,
  total_wishes integer not null default 0 check (total_wishes >= 0),
  stripe_customer_id text
);

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.well_profiles(session_id) on delete cascade,
  wish_text text not null check (char_length(wish_text) between 3 and 1200),
  answer text not null,
  meaning text not null,
  next_step text not null,
  share_line text not null,
  follow_up_question text,
  mood text not null default 'moonlit',
  theme text not null default 'uncertainty',
  coin_source text not null default 'daily' check (coin_source in ('daily','copper','moon','safety','local')),
  safety text,
  response_kind text not null default 'wish' check (response_kind in ('wish','follow_up')),
  parent_wish_id uuid references public.wishes(id) on delete set null,
  follow_up_prompt text,
  follow_up_direction text check (follow_up_direction is null or follow_up_direction in ('clarity','action','release','custom')),
  sealed_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wishes_session_created_idx
  on public.wishes(session_id, created_at desc);

create index if not exists wishes_coin_created_idx
  on public.wishes(coin_source, created_at desc);

create index if not exists wishes_parent_idx
  on public.wishes(parent_wish_id, created_at asc)
  where parent_wish_id is not null;

create table if not exists public.monthly_reflections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.well_profiles(session_id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  answer text not null,
  meaning text not null,
  next_step text not null,
  share_line text not null,
  follow_up_question text,
  mood text not null default 'moonlit',
  theme text not null default 'uncertainty',
  created_at timestamptz not null default now(),
  unique (session_id, month_key)
);

create index if not exists monthly_reflections_session_created_idx
  on public.monthly_reflections(session_id, created_at desc);

create table if not exists public.well_credit_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.well_profiles(session_id) on delete cascade,
  stripe_event_id text unique,
  credits integer not null check (credits >= 0),
  coin_type text not null default 'copper' check (coin_type in ('copper','moon')),
  pack text,
  source text not null default 'stripe',
  created_at timestamptz not null default now()
);

create index if not exists well_credit_events_session_created_idx
  on public.well_credit_events(session_id, created_at desc);

create table if not exists public.well_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null check (status in ('received','processed','ignored','failed')),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.well_profiles enable row level security;
alter table public.wishes enable row level security;
alter table public.monthly_reflections enable row level security;
alter table public.well_credit_events enable row level security;
alter table public.well_webhook_events enable row level security;

-- Intentionally no anon/authenticated policies. The secret-key backend is the only database writer.

create or replace function public.touch_well_profile(p_session_id uuid)
returns public.well_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.well_profiles;
begin
  insert into public.well_profiles(session_id)
  values (p_session_id)
  on conflict (session_id) do update set last_seen = now()
  returning * into profile;
  return profile;
end;
$$;

create or replace function public.consume_well_coin(
  p_session_id uuid,
  p_coin_intent text default 'auto'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.well_profiles;
  source text;
  intent text := lower(coalesce(p_coin_intent, 'auto'));
begin
  if intent not in ('auto','daily','copper','moon') then
    return jsonb_build_object('allowed', false, 'source', null, 'reason', 'invalid_coin');
  end if;

  insert into public.well_profiles(session_id)
  values (p_session_id)
  on conflict (session_id) do update set last_seen = now();

  select * into profile
  from public.well_profiles
  where session_id = p_session_id
  for update;

  if intent in ('auto','daily') and profile.daily_claim_date is distinct from current_date then
    update public.well_profiles
    set daily_claim_date = current_date,
        total_wishes = total_wishes + 1,
        last_seen = now()
    where session_id = p_session_id;
    source := 'daily';
  elsif intent = 'daily' then
    return jsonb_build_object('allowed', false, 'source', null, 'reason', 'daily_used');
  elsif intent in ('auto','copper') and profile.copper_credits > 0 then
    update public.well_profiles
    set copper_credits = copper_credits - 1,
        total_wishes = total_wishes + 1,
        last_seen = now()
    where session_id = p_session_id;
    source := 'copper';
  elsif intent = 'copper' then
    return jsonb_build_object('allowed', false, 'source', null, 'reason', 'no_copper');
  elsif intent in ('auto','moon') and profile.moon_credits > 0 then
    update public.well_profiles
    set moon_credits = moon_credits - 1,
        total_wishes = total_wishes + 1,
        last_seen = now()
    where session_id = p_session_id;
    source := 'moon';
  else
    return jsonb_build_object('allowed', false, 'source', null, 'reason', 'no_coin');
  end if;

  return jsonb_build_object('allowed', true, 'source', source);
end;
$$;

create or replace function public.restore_well_coin(
  p_session_id uuid,
  p_coin_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  coin text := lower(coalesce(p_coin_source, ''));
begin
  if coin = 'daily' then
    update public.well_profiles
    set daily_claim_date = case when daily_claim_date = current_date then null else daily_claim_date end,
        total_wishes = greatest(total_wishes - 1, 0),
        last_seen = now()
    where session_id = p_session_id;
  elsif coin = 'copper' then
    update public.well_profiles
    set copper_credits = copper_credits + 1,
        total_wishes = greatest(total_wishes - 1, 0),
        last_seen = now()
    where session_id = p_session_id;
  elsif coin = 'moon' then
    update public.well_profiles
    set moon_credits = moon_credits + 1,
        total_wishes = greatest(total_wishes - 1, 0),
        last_seen = now()
    where session_id = p_session_id;
  else
    return jsonb_build_object('restored', false, 'reason', 'invalid_coin');
  end if;
  return jsonb_build_object('restored', true, 'coin_type', coin);
end;
$$;

create or replace function public.grant_well_credits(
  p_session_id uuid,
  p_credits integer,
  p_coin_type text default 'copper',
  p_subscription_active boolean default false,
  p_stripe_customer_id text default null,
  p_stripe_event_id text default null,
  p_pack text default null,
  p_source text default 'stripe'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  coin text := lower(coalesce(p_coin_type, 'copper'));
  amount integer := greatest(coalesce(p_credits, 0), 0);
begin
  if coin not in ('copper','moon') then
    raise exception 'Invalid coin type';
  end if;

  if p_stripe_event_id is not null and exists (
    select 1 from public.well_credit_events where stripe_event_id = p_stripe_event_id
  ) then
    return jsonb_build_object('granted', false, 'reason', 'duplicate');
  end if;

  insert into public.well_profiles(
    session_id,
    copper_credits,
    moon_credits,
    subscription_active,
    stripe_customer_id
  )
  values (
    p_session_id,
    case when coin = 'copper' then amount else 0 end,
    case when coin = 'moon' then amount else 0 end,
    p_subscription_active,
    nullif(p_stripe_customer_id, '')
  )
  on conflict (session_id) do update
  set copper_credits = public.well_profiles.copper_credits + case when coin = 'copper' then amount else 0 end,
      moon_credits = public.well_profiles.moon_credits + case when coin = 'moon' then amount else 0 end,
      subscription_active = public.well_profiles.subscription_active or p_subscription_active,
      stripe_customer_id = coalesce(nullif(p_stripe_customer_id, ''), public.well_profiles.stripe_customer_id),
      last_seen = now();

  insert into public.well_credit_events(session_id, stripe_event_id, credits, coin_type, pack, source)
  values (p_session_id, p_stripe_event_id, amount, coin, p_pack, coalesce(nullif(p_source, ''), 'stripe'));

  return jsonb_build_object('granted', true, 'credits', amount, 'coin_type', coin);
end;
$$;

create or replace function public.set_well_subscription(
  p_session_id uuid,
  p_active boolean,
  p_stripe_customer_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.well_profiles(session_id, subscription_active, stripe_customer_id)
  values (p_session_id, p_active, nullif(p_stripe_customer_id, ''))
  on conflict (session_id) do update
  set subscription_active = p_active,
      stripe_customer_id = coalesce(nullif(p_stripe_customer_id, ''), public.well_profiles.stripe_customer_id),
      last_seen = now();
  return jsonb_build_object('updated', true, 'active', p_active);
end;
$$;

create or replace function public.record_well_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_status text,
  p_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.well_webhook_events(stripe_event_id, event_type, status, detail)
  values (p_stripe_event_id, p_event_type, p_status, left(p_detail, 500))
  on conflict (stripe_event_id) do update
  set status = excluded.status,
      detail = excluded.detail,
      updated_at = now();
  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.touch_well_profile(uuid) from public;
revoke all on function public.consume_well_coin(uuid, text) from public;
revoke all on function public.restore_well_coin(uuid, text) from public;
revoke all on function public.grant_well_credits(uuid, integer, text, boolean, text, text, text, text) from public;
revoke all on function public.set_well_subscription(uuid, boolean, text) from public;
revoke all on function public.record_well_webhook_event(text, text, text, text) from public;


-- Only the server-side Supabase service role may call these RPCs.
grant execute on function public.touch_well_profile(uuid) to service_role;
grant execute on function public.consume_well_coin(uuid, text) to service_role;
grant execute on function public.restore_well_coin(uuid, text) to service_role;
grant execute on function public.grant_well_credits(uuid, integer, text, boolean, text, text, text, text) to service_role;
grant execute on function public.set_well_subscription(uuid, boolean, text) to service_role;
grant execute on function public.record_well_webhook_event(text, text, text, text) to service_role;
