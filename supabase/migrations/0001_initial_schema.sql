-- Basketball lives in the "hoops" schema of the shared Supabase Project B ("platform").
-- One Postgres schema per app; never use public here (see portfolio docs/hosting-plan.md section 6).
create schema if not exists hoops;
grant usage on schema hoops to anon, authenticated, service_role;
alter default privileges in schema hoops grant all on tables to anon, authenticated, service_role;
alter default privileges in schema hoops grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema hoops grant all on functions to anon, authenticated, service_role;

create extension if not exists "pgcrypto";

create table if not exists hoops.sessions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hoops.shot_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references hoops.sessions(id) on delete cascade,
  captured_at timestamptz not null default now(),
  result text not null check (result in ('made', 'missed')),
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  frame_id text,
  swish boolean,
  created_at timestamptz not null default now()
);

create unique index if not exists sessions_device_id_id_idx on hoops.sessions(device_id, id);
create index if not exists shot_events_session_id_idx on hoops.shot_events(session_id);
create index if not exists shot_events_captured_at_idx on hoops.shot_events(captured_at desc);

alter table hoops.sessions enable row level security;
alter table hoops.shot_events enable row level security;

grant all on all tables in schema hoops to anon, authenticated, service_role;
grant all on all sequences in schema hoops to anon, authenticated, service_role;
