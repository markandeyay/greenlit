#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres (Docker) with a Supabase role stub, then runs
# the RLS assertions. Exits non-zero on any failure. Usage: pnpm db:verify
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME=greenlit-migration-check
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pw postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
run < supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do echo "applying $f"; run < "$f"; done
out=$(run < supabase/tests/10_rls_test.sql 2>&1) || { echo "$out"; exit 1; }
echo "$out" | grep -E "ok:|PASSED"
echo "$out" | grep -q "ALL RLS CHECKS PASSED" || { echo "RLS checks did not pass"; exit 1; }
