# Vercel and Supabase Environment Setup

This project reads Supabase credentials from runtime environment variables. Do not commit real values to the repo.

## Vercel project

- Team: `team_COuL6hLftYDdKidApgwbIQIK`
- Project: `v0-basketball-analytics-dashboard`
- Project ID: `prj_TyWdF7mKO4HtX41CGYQZvf4hrFYE`

## Required Vercel env vars

Add these to the Vercel project for Production, Preview, and Development unless intentionally separating environments:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The web dashboard uses `SUPABASE_SERVICE_ROLE_KEY` only on the server side through Next.js route handlers and server components. Never expose it with a `NEXT_PUBLIC_` prefix.

The dashboard also accepts `service_role_key` as a fallback for compatibility with Supabase's label naming, but `SUPABASE_SERVICE_ROLE_KEY` is preferred because it is explicit and conventional.

## Required Supabase Edge Function secrets

Set these as secrets for the `ingest-shot` Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INGEST_API_KEY`

The phone app sends `INGEST_API_KEY` in the `x-device-api-key` header when posting shot events. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the phone app.

## Security checks

- `SUPABASE_SERVICE_ROLE_KEY` must exist only in Vercel server-side env and Supabase Edge Function secrets.
- `INGEST_API_KEY` may exist in the iPhone app config, but it should be treated as a rotatable app secret.
- `.env`, `.env.*`, and `.vercel` are ignored by git.
- If a service role key is pasted into a chat or terminal history, rotate it after setup.
