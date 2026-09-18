-- Called by the "health" Edge Function so the UptimeRobot keep-alive ping is a
-- real database round-trip (Supabase Free pauses projects after 7 idle days).
create or replace function hoops.health_select_one()
returns integer
language sql
stable
as $$ select 1 $$;

grant execute on function hoops.health_select_one() to anon, authenticated, service_role;
