create or replace view public.session_streaks as
with ordered_events as (
  select
    session_id,
    id,
    result,
    row_number() over (partition by session_id order by captured_at, id) as event_index,
    row_number() over (partition by session_id, result order by captured_at, id) as result_index
  from public.shot_events
),
grouped_makes as (
  select
    session_id,
    event_index - result_index as streak_group
  from ordered_events
  where result = 'made'
),
aggregated as (
  select
    session_id,
    count(*) as streak_length
  from grouped_makes
  group by session_id, streak_group
)
select
  session_id,
  coalesce(max(streak_length), 0)::integer as best_streak
from aggregated
group by session_id;

create or replace view public.session_summaries as
select
  s.id as session_id,
  s.device_id,
  s.started_at,
  max(se.captured_at) as last_shot_at,
  count(se.id)::integer as attempts,
  count(*) filter (where se.result = 'made')::integer as made,
  count(*) filter (where se.result = 'missed')::integer as missed,
  round(
    coalesce(
      100.0 * (count(*) filter (where se.result = 'made')) / nullif(count(se.id), 0),
      0
    ),
    1
  ) as fg_percent,
  round(
    coalesce(
      100.0 * (
        (count(*) filter (where se.result = 'made'))
        + 0.5 * (count(*) filter (where coalesce(se.swish, false)))
      ) / nullif(count(se.id), 0),
      0
    ),
    1
  ) as efg_percent,
  round(
    coalesce(
      100.0 * (count(*) filter (where coalesce(se.swish, false))) / nullif(count(*) filter (where se.result = 'made'), 0),
      0
    ),
    1
  ) as swish_rate,
  coalesce(ss.best_streak, 0) as best_streak
from public.sessions s
left join public.shot_events se on se.session_id = s.id
left join public.session_streaks ss on ss.session_id = s.id
group by s.id, s.device_id, s.started_at, ss.best_streak;

create or replace view public.overall_analytics as
with session_fg as (
  select fg_percent from public.session_summaries where attempts > 0
)
select
  count(se.id)::integer as attempts,
  count(*) filter (where se.result = 'made')::integer as made,
  count(*) filter (where se.result = 'missed')::integer as missed,
  round(
    coalesce(
      100.0 * (count(*) filter (where se.result = 'made')) / nullif(count(se.id), 0),
      0
    ),
    1
  ) as fg_percent,
  round(
    coalesce(
      100.0 * (count(*) filter (where coalesce(se.swish, false))) / nullif(count(*) filter (where se.result = 'made'), 0),
      0
    ),
    1
  ) as swish_rate,
  round(
    coalesce((select avg(best_streak)::numeric from public.session_summaries where attempts > 0), 0),
    1
  ) as avg_streak,
  round(
    greatest(
      0,
      least(
        100,
        100 - coalesce((select stddev_samp(fg_percent) from session_fg), 0) * 2
      )
    )::numeric,
    1
  ) as consistency
from public.shot_events se;
