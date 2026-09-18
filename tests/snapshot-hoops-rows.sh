#!/usr/bin/env bash
# Snapshots every row of the hoops schema (Supabase Project B) into tests/fixtures/hoops-rows-<date>.json
# so the dashboard math can be checked against real data offline. Needs SUPABASE_ACCESS_TOKEN in the
# environment (operators: set -a; source ~/.config/portfolio-ops/secrets.env; set +a). Prints no secrets.
set -euo pipefail
cd "$(dirname "$0")/fixtures"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set}"
q() { curl -sf -X POST https://api.supabase.com/v1/projects/yzppfufqaekgaxcrsqxp/database/query \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$1" '{query:$q}')"; }
day=$(date -u +%F)
jq -n --arg day "$day" --arg now "$(date -u +%FT%H:%MZ)" \
  --argjson sessions "$(q 'select id, device_id, started_at, ended_at, title, created_at from hoops.sessions order by started_at')" \
  --argjson shots "$(q 'select id, session_id, captured_at, result, x, y, confidence, frame_id, swish from hoops.shot_events order by captured_at, id')" \
  '{snapshot_of:"Supabase Project B (yzppfufqaekgaxcrsqxp), schema hoops", taken_at:$now,
    note:"Every row in hoops.sessions and hoops.shot_events. Device ids are test-device labels, not people. Regenerate with tests/snapshot-hoops-rows.sh.",
    sessions:$sessions, shot_events:$shots}' > "hoops-rows-$day.json"
echo "wrote tests/fixtures/hoops-rows-$day.json ($(jq '.shot_events|length' "hoops-rows-$day.json") shots)"
