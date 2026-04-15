with ranked_sessions as (
  select
    id,
    device_id,
    (started_at at time zone 'UTC')::date as session_day,
    first_value(id) over (
      partition by device_id, (started_at at time zone 'UTC')::date
      order by started_at asc, id asc
    ) as canonical_session_id
  from public.sessions
),
moved_events as (
  update public.shot_events se
  set session_id = rs.canonical_session_id
  from ranked_sessions rs
  where se.session_id = rs.id
    and rs.id <> rs.canonical_session_id
  returning se.id
)
delete from public.sessions s
using ranked_sessions rs
where s.id = rs.id
  and rs.id <> rs.canonical_session_id;

create unique index if not exists sessions_device_utc_day_idx
on public.sessions (device_id, ((started_at at time zone 'UTC')::date));
