import { createClient } from "npm:@supabase/supabase-js@2";
import { validateShotEvent, type ShotEventPayload } from "./validate.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-device-api-key",
  "access-control-allow-methods": "POST, OPTIONS"
};

function getUtcDayRange(isoTimestamp: string) {
  const capturedDate = new Date(isoTimestamp);
  const start = new Date(Date.UTC(
    capturedDate.getUTCFullYear(),
    capturedDate.getUTCMonth(),
    capturedDate.getUTCDate()
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // The key is checked before the body is read, so an unauthenticated caller learns nothing about the schema.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ingestApiKey = Deno.env.get("INGEST_API_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !ingestApiKey) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500, headers: corsHeaders });
  }

  if (request.headers.get("x-device-api-key") !== ingestApiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const rawBody = await request.json().catch(() => null);
  // Timestamps before 2000 or more than a day ahead are rejected here so a device with a broken
  // clock can never create another "1970" session on the dashboard.
  const validationError = validateShotEvent(rawBody);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400, headers: corsHeaders });
  }
  const body = rawBody as ShotEventPayload;

  // Basketball lives in the "hoops" schema of the shared Supabase Project B.
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { db: { schema: "hoops" } });
  const dayRange = getUtcDayRange(body.capturedAt);
  const { data: existingSession, error: existingSessionError } = await supabase
    .from("sessions")
    .select("id, started_at")
    .eq("device_id", body.deviceId)
    .gte("started_at", dayRange.start)
    .lt("started_at", dayRange.end)
    .order("started_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingSessionError) {
    return Response.json({ error: existingSessionError.message }, { status: 400, headers: corsHeaders });
  }

  const resolvedSessionId = existingSession?.id ?? body.sessionId;
  const { error: sessionError } = existingSession
    ? await supabase
        .from("sessions")
        .update({
          device_id: body.deviceId,
          // a shot that arrives out of order can only move the start earlier, never later
          started_at:
            Date.parse(body.capturedAt) < Date.parse(existingSession.started_at) ? body.capturedAt : existingSession.started_at,
          updated_at: new Date().toISOString()
        })
        .eq("id", resolvedSessionId)
    : await supabase.from("sessions").insert({
        id: resolvedSessionId,
        device_id: body.deviceId,
        title: body.sessionTitle ?? null,
        started_at: body.capturedAt,
        updated_at: new Date().toISOString()
      });

  if (sessionError) {
    return Response.json({ error: sessionError.message }, { status: 400, headers: corsHeaders });
  }

  if (existingSession && body.sessionTitle !== undefined) {
    const { error: sessionTitleError } = await supabase
      .from("sessions")
      .update({
        title: body.sessionTitle,
        updated_at: new Date().toISOString()
      })
      .eq("id", resolvedSessionId);

    if (sessionTitleError) {
      return Response.json({ error: sessionTitleError.message }, { status: 400, headers: corsHeaders });
    }
  }

  const { error } = await supabase.from("shot_events").upsert({
    id: body.id,
    session_id: resolvedSessionId,
    captured_at: body.capturedAt,
    result: body.result,
    x: body.x,
    y: body.y,
    confidence: body.confidence,
    frame_id: body.frameId ?? null,
    swish: body.swish ?? null
  }, {
    onConflict: "id",
    ignoreDuplicates: true
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
  }

  const { data: storedEvent, error: storedEventError } = await supabase
    .from("shot_events")
    .select("*")
    .eq("id", body.id)
    .single();

  if (storedEventError) {
    return Response.json({ error: storedEventError.message }, { status: 400, headers: corsHeaders });
  }

  captureShotIngested(storedEvent).catch(() => undefined);

  return Response.json({ accepted: true, event: storedEvent }, { status: 200, headers: corsHeaders });
});

// PostHog custom event for the app's core action (see portfolio docs/analytics.md).
// Optional: only sends when POSTHOG_KEY is set as a function secret; never blocks the response.
async function captureShotIngested(event: { id: string; session_id: string; result: string; swish: boolean | null }) {
  const key = Deno.env.get("POSTHOG_KEY");
  if (!key) return;
  const host = Deno.env.get("POSTHOG_HOST") ?? "https://us.i.posthog.com";
  await fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event: "shot_ingested",
      distinct_id: "hoops-ingest-shot",
      properties: {
        $host: "hoops.kalpkan.com",
        session_id: event.session_id,
        result: event.result,
        swish: event.swish ?? false,
        $process_person_profile: false
      }
    })
  });
}
