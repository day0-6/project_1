#!/usr/bin/env bash
# 로컬 Postgres에 임시 DB를 만들어 마이그레이션 + RLS 테스트를 실행한다.
set -euo pipefail
cd "$(dirname "$0")"
DB=hanmadi_test
PSQL="psql -X -q -v ON_ERROR_STOP=1"
dropdb --if-exists "$DB" && createdb "$DB"
$PSQL -d "$DB" -f auth_stub.sql
for f in ../migrations/*.sql; do $PSQL -d "$DB" -f "$f"; done
psql -X -q -d "$DB" -f rls_test.sql
# 시드는 깨끗한 DB에서 검증
dropdb "$DB" && createdb "$DB"
$PSQL -d "$DB" -f auth_stub.sql
for f in ../migrations/*.sql; do $PSQL -d "$DB" -f "$f"; done
psql -X -q -d "$DB" -f seed_test.sql
dropdb "$DB"
