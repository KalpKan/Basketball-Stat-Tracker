// Pure validation for the ingest payload, shared by the Edge Function and its node test.

export interface ShotEventPayload {
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

/** Shots stamped before this are clock failures (an old iOS build sent epoch zero). */
export const MIN_CAPTURED_AT = "2000-01-01T00:00:00.000Z";
/** Allowed clock skew into the future. */
export const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

const requiredFields = ["id", "deviceId", "sessionId", "capturedAt", "result", "x", "y", "confidence"] as const;

/** Returns null when the body is a valid shot event, otherwise the error message for a 400 response. */
export function validateShotEvent(body: unknown, now = new Date()): string | null {
  if (!body || typeof body !== "object") {
    return "Invalid JSON payload";
  }
  const event = body as Record<string, unknown>;

  for (const field of requiredFields) {
    if (event[field] === undefined || event[field] === null) {
      return `Missing field: ${field}`;
    }
  }

  for (const field of ["id", "deviceId", "sessionId"] as const) {
    if (typeof event[field] !== "string" || !(event[field] as string).trim()) {
      return "id, deviceId, and sessionId must be non-empty strings";
    }
  }

  const capturedAtMs = typeof event.capturedAt === "string" ? Date.parse(event.capturedAt) : Number.NaN;
  if (Number.isNaN(capturedAtMs)) {
    return "capturedAt must be a valid ISO-8601 timestamp";
  }
  if (capturedAtMs < Date.parse(MIN_CAPTURED_AT)) {
    return `capturedAt must be on or after ${MIN_CAPTURED_AT.slice(0, 10)} (got ${new Date(capturedAtMs).toISOString()}); check the device clock`;
  }
  if (capturedAtMs > now.getTime() + MAX_FUTURE_MS) {
    return `capturedAt is in the future (${new Date(capturedAtMs).toISOString()}); check the device clock`;
  }

  if (event.result !== "made" && event.result !== "missed") {
    return "Invalid result value";
  }

  const x = event.x;
  const y = event.y;
  if (typeof x !== "number" || typeof y !== "number" || x < 0 || x > 1 || y < 0 || y > 1) {
    return "Shot coordinates must be normalized between 0 and 1";
  }

  const confidence = event.confidence;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    return "Confidence must be between 0 and 1";
  }

  return null;
}
