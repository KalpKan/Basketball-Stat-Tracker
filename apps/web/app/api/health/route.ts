import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

// Health route for UptimeRobot and the hub's live badge: {ok, db, service}.
// db is "ok" after a real round-trip (hoops.health_select_one(), i.e. select 1),
// "skipped" when the Supabase settings are missing, "error" when the query failed
// (then the status is 503 so the monitor alerts instead of seeing a green page).
export async function GET() {
  const headers = { "cache-control": "no-store" };
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ ok: true, db: "skipped", service: "hoops", time: new Date().toISOString() }, { headers });
  }

  try {
    const { data, error } = await supabase.rpc("health_select_one");
    if (error || data !== 1) {
      return NextResponse.json(
        { ok: false, db: "error", service: "hoops", error: error?.message ?? "unexpected result", time: new Date().toISOString() },
        { status: 503, headers }
      );
    }
    return NextResponse.json({ ok: true, db: "ok", service: "hoops", time: new Date().toISOString() }, { headers });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    return NextResponse.json({ ok: false, db: "error", service: "hoops", error: message, time: new Date().toISOString() }, { status: 503, headers });
  }
}
