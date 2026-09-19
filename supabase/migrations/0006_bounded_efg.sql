-- eFG% v2: bounded at 100. The v1 proxy divided (made + 0.5 * swishes) by attempts and reached
-- 150 % on a single made swish (session 90000000-0000-4000-8000-000000000100). Adding the swish
-- bonus to the denominator keeps the reward for clean makes and caps the score at 100.
-- The dashboard computes the same formula in apps/web/lib/dashboard-data.ts (computeEfgPercent);
-- this view is for SQL consumers and must stay in step with it.
create or replace view hoops.session_summaries as
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
      ) / nullif(count(se.id) + 0.5 * (count(*) filter (where coalesce(se.swish, false))), 0),
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
from hoops.sessions s
left join hoops.shot_events se on se.session_id = s.id
left join hoops.session_streaks ss on ss.session_id = s.id
group by s.id, s.device_id, s.started_at, ss.best_streak;
