import { createClient } from "npm:@supabase/supabase-js@2";

// Keep-alive health route for Supabase Project B ("platform").
// UptimeRobot calls this every 5 minutes; it runs `select 1` through the
// hoops schema so the ping counts as real database activity and the Free
// project never pauses. Returns {ok:true, db:"ok"} on success.
Deno.serve(async request => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const headers = { "cache-control": "no-store", "content-type": "application/json" };

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ ok: false, db: "unconfigured" }, { status: 500, headers });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "hoops" } });
  const { data, error } = await supabase.rpc("health_select_one");

  if (error || data !== 1) {
    return Response.json({ ok: false, db: error?.message ?? "unexpected result" }, { status: 500, headers });
  }

  return Response.json({ ok: true, db: "ok", project: "platform", time: new Date().toISOString() }, { headers });
});
