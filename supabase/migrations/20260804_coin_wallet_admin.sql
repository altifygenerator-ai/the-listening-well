-- Upgrade an existing Listening Well database from the single paid_credits wallet.
-- Safe to run once. Existing paid credits are moved to copper credits and paid_credits is zeroed.

alter table public.well_profiles add column if not exists copper_credits integer not null default 0 check (copper_credits >= 0);
alter table public.well_profiles add column if not exists moon_credits integer not null default 0 check (moon_credits >= 0);

update public.well_profiles
set copper_credits = copper_credits + paid_credits,
    paid_credits = 0
where paid_credits > 0;

alter table public.well_credit_events add column if not exists coin_type text not null default 'copper';
alter table public.well_credit_events add column if not exists pack text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'well_credit_events_coin_type_check'
      and conrelid = 'public.well_credit_events'::regclass
  ) then
    alter table public.well_credit_events
      add constraint well_credit_events_coin_type_check check (coin_type in ('copper','moon'));
  end if;
end $$;

create table if not exists public.well_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null check (status in ('received','processed','ignored','failed')),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.well_webhook_events enable row level security;

update public.wishes set coin_source = 'copper' where coin_source = 'paid';

alter table public.wishes drop constraint if exists wishes_coin_source_check;
alter table public.wishes add constraint wishes_coin_source_check
  check (coin_source in ('daily','copper','moon','safety','local'));

-- Remove older RPC signatures so PostgREST cannot choose an ambiguous overload.
drop function if exists public.consume_well_coin(uuid);
drop function if exists public.grant_well_credits(uuid, integer, boolean, text, text);

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
  insert into public.well_profiles(session_id) values (p_session_id)
  on conflict (session_id) do update set last_seen = now();
  select * into profile from public.well_profiles where session_id = p_session_id for update;
  if intent in ('auto','daily') and profile.daily_claim_date is distinct from current_date then
    update public.well_profiles set daily_claim_date = current_date, total_wishes = total_wishes + 1, last_seen = now() where session_id = p_session_id;
    source := 'daily';
  elsif intent = 'daily' then
    return jsonb_build_object('allowed', false, 'source', null, 'reason', 'daily_used');
  elsif intent in ('auto','copper') and profile.copper_credits > 0 then
    update public.well_profiles set copper_credits = copper_credits - 1, total_wishes = total_wishes + 1, last_seen = now() where session_id = p_session_id;
    source := 'copper';
  elsif intent = 'copper' then
    return jsonb_build_object('allowed', false, 'source', null, 'reason', 'no_copper');
  elsif intent in ('auto','moon') and profile.moon_credits > 0 then
    update public.well_profiles set moon_credits = moon_credits - 1, total_wishes = total_wishes + 1, last_seen = now() where session_id = p_session_id;
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
  if coin not in ('copper','moon') then raise exception 'Invalid coin type'; end if;
  if p_stripe_event_id is not null and exists (select 1 from public.well_credit_events where stripe_event_id = p_stripe_event_id) then
    return jsonb_build_object('granted', false, 'reason', 'duplicate');
  end if;
  insert into public.well_profiles(session_id, copper_credits, moon_credits, subscription_active, stripe_customer_id)
  values (p_session_id, case when coin='copper' then amount else 0 end, case when coin='moon' then amount else 0 end, p_subscription_active, nullif(p_stripe_customer_id,''))
  on conflict (session_id) do update
  set copper_credits = public.well_profiles.copper_credits + case when coin='copper' then amount else 0 end,
      moon_credits = public.well_profiles.moon_credits + case when coin='moon' then amount else 0 end,
      subscription_active = public.well_profiles.subscription_active or p_subscription_active,
      stripe_customer_id = coalesce(nullif(p_stripe_customer_id,''), public.well_profiles.stripe_customer_id),
      last_seen = now();
  insert into public.well_credit_events(session_id, stripe_event_id, credits, coin_type, pack, source)
  values (p_session_id, p_stripe_event_id, amount, coin, p_pack, coalesce(nullif(p_source,''),'stripe'));
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

create or replace function public.record_well_webhook_event(p_stripe_event_id text, p_event_type text, p_status text, p_detail text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  insert into public.well_webhook_events(stripe_event_id,event_type,status,detail)
  values(p_stripe_event_id,p_event_type,p_status,left(p_detail,500))
  on conflict(stripe_event_id) do update set status=excluded.status, detail=excluded.detail, updated_at=now();
  return jsonb_build_object('recorded',true);
end; $$;

revoke all on function public.consume_well_coin(uuid, text) from public;
revoke all on function public.restore_well_coin(uuid, text) from public;
revoke all on function public.grant_well_credits(uuid, integer, text, boolean, text, text, text, text) from public;
revoke all on function public.record_well_webhook_event(text, text, text, text) from public;

revoke all on function public.set_well_subscription(uuid, boolean, text) from public;
grant execute on function public.touch_well_profile(uuid) to service_role;
grant execute on function public.consume_well_coin(uuid, text) to service_role;
grant execute on function public.restore_well_coin(uuid, text) to service_role;
grant execute on function public.grant_well_credits(uuid, integer, text, boolean, text, text, text, text) to service_role;
grant execute on function public.set_well_subscription(uuid, boolean, text) to service_role;
grant execute on function public.record_well_webhook_event(text, text, text, text) to service_role;
