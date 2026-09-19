# Basketball Stat Tracker

Hoops Analytics is a personal basketball shooting tracker: a web dashboard (live at
https://hoops.kalpkan.com) that shows shot maps, session stats and progress, fed by a
Supabase backend. The iPhone capture app is a **stub** (two SwiftUI files, no working
capture yet); today shots reach the backend through the ingest API described below.

## Repo layout

- `apps/mobile` - iPhone app stub (SwiftUI). Planned, not functional yet
- `apps/web` - Next.js dashboard for Vercel
- `supabase` - database schema (the `hoops` schema in the shared Supabase project "platform"), policies, and Edge Functions
- `packages/contracts` - shared TypeScript event contracts and generated types

## Product direction

- Capture and infer shots on-device on iPhone 15 Pro
- Upload structured shot events to Supabase
- Visualize session analytics, shot maps, and progress on the web dashboard

## Data pipeline

- A client (the future iPhone app, or any script) sends structured shot events to the Supabase Edge Function at `/functions/v1/hoops-ingest-shot`
- The Edge Function validates the payload, verifies `x-device-api-key`, upserts the session row, and inserts the shot event idempotently by client event `id`
- Supabase stores raw events in `hoops.shot_events`; SQL views in the `hoops` schema (`session_summaries` etc.) expose the same metrics for SQL consumers
- The Next.js dashboard reads the raw sessions and shots through a server-side API route (`/api/dashboard`), computes every number in `apps/web/lib/dashboard-data.ts` (pure, unit-tested against an independent Python ground truth in `tests/`), and refreshes every 5 seconds
- One row per device per UTC day: the ingest function reuses a device's session for the day, and the dashboard merges on the same key. Dates are formatted once on the server in UTC, so every visitor sees the same label on the pill, the chart and the table
- Sessions or shots stamped before 2000-01-01 (a device with a broken clock) are hidden from every number; the page says how many were hidden. The ingest function now rejects such timestamps (and anything more than a day in the future) with `400`
- The dashboard shows a yellow "Sample data" banner (built-in sample shots) when the Supabase settings are missing, and a red one when they are present but the database could not be reached. `/api/health` returns `{ok, db, service}` (`db: ok | skipped | error`, HTTP 503 on error) for the uptime monitor

## Backend notes

- v1 auth is a shared ingest API key sent in `x-device-api-key` to the Edge Function
- `id` is the canonical client event id and must be stable across retries for idempotent ingestion
- `started_at` is set from the first accepted event in a session and moves earlier if an earlier shot arrives later
- `eFG%` is a bounded mini-hoop proxy (v2, 2026-09-18): `100 * (made + 0.5 * swishes) / (attempts + 0.5 * swishes)`. The v1 formula divided by `attempts` only and reached 150 % on a single swish
- `consistency` is `max(0, min(100, 100 - 2 * sample_stddev(FG% of the sessions shown)))`, computed on the same rows as the Session History table; it is "n/a" for a single session
- The dashboard reads at most the newest 200 sessions and their shots (10 pages of 1000); the `hoops.overall_analytics` view is no longer used by the page

## Required environment

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INGEST_API_KEY`

Plus `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` for analytics. Names are listed in
`.env.example`; never commit values. For the Edge Functions, `INGEST_API_KEY` (and optionally
`POSTHOG_KEY`) are Supabase Edge Function secrets; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are injected by Supabase automatically.

## How to run this / How to deploy this / Where the settings live

Written for a non-developer. You should not normally need any of this: the site deploys
itself and the settings are already in place.

**How to run this on your computer**

1. Install Node.js (version 22) from nodejs.org.
2. Open Terminal, go to this folder, and run `npx pnpm install`.
3. Run `npx pnpm --filter @basketball-stat-tracker/web dev` and open http://localhost:3000.
   Without a `.env` file you will see the "Demo data" banner and sample shots, which is fine.
4. To run the tests: `npx pnpm test` (unit tests for the metric math against `tests/fixtures/`, the chart, the banners and the ingest validation). To check the live page against the ground truth: `curl -s https://hoops.kalpkan.com/api/dashboard > /tmp/p.json && python3 tests/compute-expected-metrics.py --check /tmp/p.json`.

**How to deploy this**

- Every push to the `main` branch on GitHub redeploys the dashboard on Vercel
  (project `v0-basketball-analytics-dashboard`, team "Kk's projects"). Nothing to click.
- To deploy by hand: `npx vercel --prod --yes` from this folder.
- The database and the two Edge Functions live in Supabase Project B ("platform"), schema
  `hoops`. To change the database, add a new numbered file in `supabase/migrations/` and
  apply it (an agent does this with the portfolio-ops runbook "Add a schema to Supabase
  Project B"). To redeploy a function: `npx supabase functions deploy hoops-ingest-shot`
  (or `health`) with your Supabase access token in the shell.

**Where the settings live**

| Setting | Where |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INGEST_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Vercel -> project `v0-basketball-analytics-dashboard` -> Settings -> Environment Variables |
| `INGEST_API_KEY`, `POSTHOG_KEY` (for the Edge Functions) | Supabase -> project "platform" -> Edge Functions -> Secrets |
| Database tables and views | Supabase -> project "platform" -> Table Editor, schema `hoops` |
| Domain `hoops.kalpkan.com` | Cloudflare DNS (record) and Vercel project Settings -> Domains |
| Uptime and keep-alive monitors | UptimeRobot, status page https://stats.uptimerobot.com/a6n3Wx3PBp |

The full operating manual for all of Kalp's sites is the `portfolio-ops` skill in the
`KalpKan/portfolio` repo (`skills/portfolio-ops/`).

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
