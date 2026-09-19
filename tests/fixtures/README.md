# Test fixtures for the hoops dashboard

Ground truth for checking that https://hoops.kalpkan.com shows the right numbers. Written 2026-09-18
for the functional audit (`KalpKan/portfolio` `docs/reports/hoops-spec.md`).

| File | What it is | How it was made |
|---|---|---|
| `hoops-rows-2026-09-18.json` | Every row of `hoops.sessions` (5) and `hoops.shot_events` (95) in Supabase Project B on 2026-09-18. Device ids are test-device labels (`shootit-ios-manual-test`, `frontend-backend-test`, `t11-sample`), not people. | `../snapshot-hoops-rows.sh` (Management API SQL endpoint; needs `SUPABASE_ACCESS_TOKEN`) |
| `hoops-expected-metrics.json` | Independent ground truth for those rows: per session, per UTC day (the dashboard's merge), and overall. FG%, eFG%, swish rate, best streak, consistency on both bases. | `../compute-expected-metrics.py` (pure Python, no SQL, no app code) |
| `synthetic-tap-session.json` | The three-shot session from `docs/mobile-backend-handoff.md` with the aggregates that doc promises (3 / 2 / 1, FG 66.7, eFG 83.3, swish 50, streak 1). | copied from the handoff doc; verified live on 2026-09-18 as device `t11-sample` |
| `synthetic-30-sessions.json` | 30 sessions on 30 distinct UTC days (June 2026, one test device, 801 shots), same shape as the snapshot. For the Progress chart "30 bars must not overflow" bar (spec story 3) and for feeding the pure functions in `apps/web/lib/dashboard-data.ts`. Every session's eFG% <= 100; no 1970 rows. Never sent to the database. | `../generate-synthetic-sessions.py` (seed 20260918, deterministic) |
| `synthetic-30-expected-metrics.json` | Ground truth for the synthetic corpus (per session = per UTC day here, plus overall). | `../compute-expected-metrics.py --rows fixtures/synthetic-30-sessions.json --out fixtures/synthetic-30-expected-metrics.json` |

## Checking the live dashboard against the ground truth

```bash
curl -s https://hoops.kalpkan.com/api/dashboard > /tmp/hoops-payload.json
python3 tests/compute-expected-metrics.py --check /tmp/hoops-payload.json
```

Exit code 0 and the line `all counts, FG%, eFG%, swish rate and streaks match the ground truth` means the
numbers on the page are right for the rows in the snapshot. Take a fresh snapshot first if shots were
added since (`tests/snapshot-hoops-rows.sh`, then point `ROWS` in the script at the new file).

## Known facts about this data (so nobody "fixes" the ground truth)

- 23 of the 95 shots carry `captured_at` on **1970-01-01** (an old iOS test sent epoch-zero timestamps).
  Ground truth keeps them; the spec says the dashboard must not present them as a real "Jan 1" session.
- Session `90000000-0000-4000-8000-000000000100` is a single made swish, so the v1 eFG% proxy gives
  **150.0%**. That is what the README formula produces; the spec treats an eFG% above 100 as a defect
  in the formula, not in the fixture.
- Two devices shot on 2026-04-15 (UTC); the dashboard merges them into one `day-2026-04-15` row (57 shots).
- `consistency` on the raw-session basis is 67.6, on the UTC-day basis 85.9. The live dashboard shows
  67.6 next to a table of 4 UTC-day rows, which is the basis mismatch the spec calls out.
