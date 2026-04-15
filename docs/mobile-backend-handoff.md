# Mobile Backend Handoff

This document is for the iPhone app implementation agent. It describes the live Supabase backend contract, the expected request flow, and the simplest end-to-end synthetic test path.

## Live backend summary

- Supabase project ref: `yzppfufqaekgaxcrsqxp`
- Base URL: `https://yzppfufqaekgaxcrsqxp.supabase.co`
- Ingest endpoint: `POST /functions/v1/ingest-shot`
- Auth strategy: shared ingest API key in header `x-device-api-key`
- Backend is live and expects structured shot events from the phone
- Backend does not expect video, images, or frame uploads in v1

## Required request

Endpoint:

```text
POST https://yzppfufqaekgaxcrsqxp.supabase.co/functions/v1/ingest-shot
```

Headers:

```text
Content-Type: application/json
x-device-api-key: <INGEST_API_KEY>
```

Body:

```json
{
  "id": "0f548d8d-f932-4e8d-a8e4-2fa07aaf6af0",
  "deviceId": "iphone-15-pro",
  "sessionId": "4c95d8e0-5d9b-4c44-9da0-0ceee3124f8f",
  "sessionTitle": "Bedroom mini hoop",
  "capturedAt": "2026-04-15T22:14:10.000Z",
  "result": "made",
  "x": 0.52,
  "y": 0.41,
  "confidence": 0.94,
  "frameId": "frame-00128",
  "swish": true
}
```

## Field rules

- `id`
  - Required
  - Must be a stable UUID string per client event
  - This is the idempotency key
  - If the app retries the same event, reuse the same `id`
- `deviceId`
  - Required
  - Stable identifier for the phone/app installation or chosen device identity
- `sessionId`
  - Required
  - Stable UUID for the session
  - Reuse for all shots in the same session
- `sessionTitle`
  - Optional
  - Sent when known
  - Can be omitted or set to `null`
- `capturedAt`
  - Required
  - ISO-8601 timestamp string
- `result`
  - Required
  - `"made"` or `"missed"`
- `x`
  - Required
  - Normalized hoop-relative coordinate from `0` to `1`
- `y`
  - Required
  - Normalized hoop-relative coordinate from `0` to `1`
- `confidence`
  - Required
  - Number from `0` to `1`
- `frameId`
  - Optional
  - Use if the app already has an internal frame/sample identifier
- `swish`
  - Optional
  - `true`, `false`, or omitted/null if not known

## Backend behavior the app should rely on

- The backend creates the session row on the first accepted event for a new `sessionId`
- The backend preserves the original `started_at` from the first event
- Re-sending the same event `id` is safe
- Invalid coordinates, confidence, timestamps, or result values are rejected
- Missing/incorrect `x-device-api-key` returns `401`

## What the app should store locally

- `baseURL`
- `ingestApiKey`
- current `sessionId`
- stable `deviceId`
- generated event `id` for each shot
- a retry queue for failed uploads

## Recommended mobile upload flow

1. When the user starts a session, generate a `sessionId` UUID once.
2. Keep one stable `deviceId` for the installation or chosen local device identity.
3. For every accepted inferred shot, generate a unique event `id`.
4. Build the payload exactly in the backend contract shape.
5. `POST` it to `/functions/v1/ingest-shot`.
6. If the request fails for transport reasons, retry the same payload with the same `id`.
7. If the request returns a non-2xx validation error, do not mutate the payload and do not generate a new `id` for the same event unless the app intentionally treats it as a new event.

## Synthetic tap test

Use the production ingest route for the test. Do not create a second debug ingest backend.

Goal:

- user taps anywhere on a debug shot canvas in the app
- app converts tap location into normalized `x` and `y`
- app sends a synthetic shot event to the real `ingest-shot` function
- web dashboard should then show the event in the live shot map and aggregate metrics

### Why this is the right test

- it exercises the real auth path
- it exercises the real ingest function
- it writes to the real `sessions` and `shot_events` tables
- it updates the real analytics views the dashboard already reads
- there is no separate mock backend path to drift from production

## Synthetic tap test implementation requirements

### App-side debug UI

The app agent should implement a temporary debug screen or dev-only panel with:

- a tappable shot canvas
- a segmented control or toggle for `made` / `missed`
- an optional toggle for `swish`
- a button to start/reset a synthetic test session
- a simple recent-upload status view

### Tap-to-shot mapping

When the user taps the canvas:

- convert tap point to normalized coordinates
- clamp both values to `[0, 1]`
- send one shot event immediately

Suggested mapping:

- `x = tapX / canvasWidth`
- `y = tapY / canvasHeight`

### Suggested synthetic payload defaults

- `deviceId`: stable debug device id such as the same app/device id already used elsewhere
- `sessionId`: keep one active debug session id until the user resets
- `sessionTitle`: `"Manual Tap Test"`
- `capturedAt`: current timestamp
- `result`: UI toggle value
- `confidence`: `1.0` for manual taps
- `frameId`: something like `"manual-tap-\(counter)"`
- `swish`: UI toggle value or `false`

### Dashboard expectations

After one or more taps:

- `shot_map_points` should contain the new rows
- `session_summaries` should contain or update the active session
- `overall_analytics` should reflect the new totals
- `progress_over_time` should include the session once attempts > 0

## Minimal verification sequence

1. Open the debug shot screen in the app.
2. Start a synthetic session.
3. Tap the canvas three times:
   - one made swish
   - one missed
   - one made non-swish
4. Confirm the app sees `200 accepted: true` responses.
5. Refresh the dashboard or wait for its poll cycle.
6. Confirm:
   - attempts increased by 3
   - made increased by 2
   - missed increased by 1
   - shot map shows 3 new points
   - session history includes the synthetic session

## Example synthetic events

Event 1:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "deviceId": "iphone-15-pro-debug",
  "sessionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "sessionTitle": "Manual Tap Test",
  "capturedAt": "2026-04-15T23:00:00.000Z",
  "result": "made",
  "x": 0.52,
  "y": 0.41,
  "confidence": 1.0,
  "frameId": "manual-tap-1",
  "swish": true
}
```

Event 2:

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "deviceId": "iphone-15-pro-debug",
  "sessionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "sessionTitle": "Manual Tap Test",
  "capturedAt": "2026-04-15T23:00:03.000Z",
  "result": "missed",
  "x": 0.22,
  "y": 0.66,
  "confidence": 1.0,
  "frameId": "manual-tap-2",
  "swish": false
}
```

Event 3:

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "deviceId": "iphone-15-pro-debug",
  "sessionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "sessionTitle": "Manual Tap Test",
  "capturedAt": "2026-04-15T23:00:06.000Z",
  "result": "made",
  "x": 0.61,
  "y": 0.35,
  "confidence": 1.0,
  "frameId": "manual-tap-3",
  "swish": false
}
```

Expected aggregate result for that synthetic session:

- attempts: `3`
- made: `2`
- missed: `1`
- fg_percent: `66.7`
- efg_percent: `83.3`
- swish_rate: `50.0`
- best_streak: `1`

## Important security notes for the app agent

- Do not log the ingest API key
- Do not print the raw request headers in debug logs
- Keep the key in app config/secrets handling, not in user-visible UI
- The service role key must never be used by the app
- The app only needs the ingest endpoint URL and the ingest API key

## Backend read models the dashboard already uses

- `public.session_summaries`
- `public.overall_analytics`
- `public.progress_over_time`
- `public.shot_map_points`

No extra backend work is required for the synthetic tap test beyond calling the existing ingest route with synthetic data.
