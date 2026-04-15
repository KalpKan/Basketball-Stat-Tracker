# Basketball Stat Tracker

Hoops Analytics is a personal iPhone-first basketball shooting tracker.

## Repo layout

- `apps/mobile` - iPhone app built with SwiftUI, AVFoundation, and Vision/Core ML
- `apps/web` - Next.js dashboard for Vercel
- `supabase` - database schema, policies, and Edge Functions
- `packages/contracts` - shared TypeScript event contracts and generated types

## Product direction

- Capture and infer shots on-device on iPhone 15 Pro
- Upload structured shot events to Supabase
- Visualize session analytics, shot maps, and progress on the web dashboard

## Data pipeline

- iPhone app sends structured shot events to the Supabase Edge Function at `/functions/v1/ingest-shot`
- The Edge Function validates the payload, verifies `x-device-api-key`, upserts the session row, and inserts the shot event idempotently by client event `id`
- Supabase stores raw events in `shot_events` and computes dashboard-friendly metrics through SQL views
- The Next.js dashboard reads those analytics through a server-side API route and refreshes every 5 seconds

## Backend notes

- v1 auth is a shared ingest API key sent in `x-device-api-key` to the Edge Function
- `id` is the canonical client event id and must be stable across retries for idempotent ingestion
- `started_at` is set from the first accepted event in a session and is preserved on later uploads
- `eFG%` is a v1 proxy: `((made + 0.5 * swishes) / attempts) * 100`
- `consistency` is a practical score derived from session FG% variance: `max(0, min(100, 100 - 2 * stddev(session_fg_percent)))`

## Required environment

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INGEST_API_KEY`

For the Supabase Edge Function, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`INGEST_API_KEY` as project secrets in Supabase in addition to any local `.env` usage.

## Mobile ingest payload

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
