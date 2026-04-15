create or replace view public.progress_over_time as
select
  session_id,
  started_at,
  attempts,
  made,
  missed,
  fg_percent,
  efg_percent,
  best_streak
from public.session_summaries
where attempts > 0;

create or replace view public.shot_map_points as
select
  id,
  session_id,
  captured_at,
  result,
  x,
  y,
  confidence,
  frame_id,
  swish
from public.shot_events;
