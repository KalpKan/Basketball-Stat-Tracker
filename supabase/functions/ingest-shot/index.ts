import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-device-api-key",
  "access-control-allow-methods": "POST, OPTIONS"
};

interface ShotEventPayload {
  id: string;
  deviceId: string;
  sessionId: string;
  capturedAt: string;
  result: "made" | "missed";
  x: number;
  y: number;
  confidence: number;
  frameId?: string | null;
  swish?: boolean | null;
  sessionTitle?: string | null;
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = (await request.json().catch(() => null)) as ShotEventPayload | null;
  if (!body) {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400, headers: corsHeaders });
  }

  const requiredFields = ["id", "deviceId", "sessionId", "capturedAt", "result", "x", "y", "confidence"] as const;
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null) {
      return Response.json({ error: `Missing field: ${field}` }, { status: 400, headers: corsHeaders });
    }
  }

  if (!body.id.trim() || !body.deviceId.trim() || !body.sessionId.trim()) {
    return Response.json({ error: "id, deviceId, and sessionId must be non-empty strings" }, { status: 400, headers: corsHeaders });
  }

  if (Number.isNaN(Date.parse(body.capturedAt))) {
    return Response.json({ error: "capturedAt must be a valid ISO-8601 timestamp" }, { status: 400, headers: corsHeaders });
  }

  if (!["made", "missed"].includes(body.result)) {
    return Response.json({ error: "Invalid result value" }, { status: 400, headers: corsHeaders });
  }

  if (body.x < 0 || body.x > 1 || body.y < 0 || body.y > 1) {
    return Response.json({ error: "Shot coordinates must be normalized between 0 and 1" }, { status: 400, headers: corsHeaders });
  }

  if (body.confidence < 0 || body.confidence > 1) {
    return Response.json({ error: "Confidence must be between 0 and 1" }, { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ingestApiKey = Deno.env.get("INGEST_API_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !ingestApiKey) {
    return Response.json({ error: "Supabase is not configured" }, { status: 500, headers: corsHeaders });
  }

  if (request.headers.get("x-device-api-key") !== ingestApiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: existingSession, error: existingSessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", body.sessionId)
    .maybeSingle();

  if (existingSessionError) {
    return Response.json({ error: existingSessionError.message }, { status: 400, headers: corsHeaders });
  }

  const { error: sessionError } = existingSession
    ? await supabase
        .from("sessions")
        .update({
          device_id: body.deviceId,
          updated_at: new Date().toISOString()
        })
        .eq("id", body.sessionId)
    : await supabase.from("sessions").insert({
        id: body.sessionId,
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
      .eq("id", body.sessionId);

    if (sessionTitleError) {
      return Response.json({ error: sessionTitleError.message }, { status: 400, headers: corsHeaders });
    }
  }

  const { error } = await supabase.from("shot_events").upsert({
    id: body.id,
    session_id: body.sessionId,
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

  return Response.json({ accepted: true, event: storedEvent }, { status: 200, headers: corsHeaders });
});
