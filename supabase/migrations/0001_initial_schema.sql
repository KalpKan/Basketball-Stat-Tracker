create extension if not exists "pgcrypto";

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shot_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  captured_at timestamptz not null default now(),
  result text not null check (result in ('made', 'missed')),
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  frame_id text,
  swish boolean,
  created_at timestamptz not null default now()
);

create unique index if not exists sessions_device_id_id_idx on public.sessions(device_id, id);
create index if not exists shot_events_session_id_idx on public.shot_events(session_id);
create index if not exists shot_events_captured_at_idx on public.shot_events(captured_at desc);

alter table public.sessions enable row level security;
alter table public.shot_events enable row level security;
