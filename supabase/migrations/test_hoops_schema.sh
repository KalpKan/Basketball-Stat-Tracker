#!/usr/bin/env bash
# Guards the "one schema per app in Project B" rule: every basketball migration
# must target the hoops schema and never touch public.
set -e; cd "$(dirname "$0")"
if grep -n 'public\.' 0*.sql; then echo "FAIL: public. reference"; exit 1; fi
grep -q 'create schema if not exists hoops' 0001_initial_schema.sql || { echo "FAIL: no create schema"; exit 1; }
grep -q 'grant usage on schema hoops to anon, authenticated, service_role' 0001_initial_schema.sql || { echo "FAIL: no grants"; exit 1; }
echo PASS
