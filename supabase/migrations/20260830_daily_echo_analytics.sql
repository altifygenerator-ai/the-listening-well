-- Throw a Penny v1.8.0: privacy-safe product analytics for Daily Echo retention.
-- Safe to run more than once.

create table if not exists public.analytics_events (
  event_id uuid primary key,
  session_id uuid not null references public.well_profiles(session_id) on delete cascade,
  event_name text not null check (char_length(event_name) between 2 and 80),
  occurred_at timestamptz not null default now(),
  app_version text,
  experiment_id text,
  variant text,
  properties jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_session_time_idx
  on public.analytics_events(session_id, occurred_at desc);
create index if not exists analytics_events_name_time_idx
  on public.analytics_events(event_name, occurred_at desc);

alter table public.analytics_events enable row level security;
grant insert, select on public.analytics_events to service_role;
-- No anon/authenticated policies. Server/service-role only, matching the rest of the well.
