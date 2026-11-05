#!/usr/bin/env bash
# Disposable PostgreSQL ONLY; captures all spawned HTTP server coverage.
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
ROOT="$PWD"
# A stale server must never receive this isolated suite's HTTP requests.
node -e 'const s=require("node:net").createServer();s.on("error",()=>{console.error("ERROR: coverage HTTP port 8088 is already in use");process.exit(2)});s.listen(8088,"127.0.0.1",()=>s.close())'
name="apartment-coverage-$$"
scratch="$(mktemp -d /tmp/apartment-coverage-XXXXXXXX)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf -- "$scratch"; }
trap cleanup EXIT
# Bind a random host loopback port; never point tests at DEV storage.
docker run -d --memory=256m --cpus=0.75 --pids-limit=128 --name "$name" -p 127.0.0.1::5432 -e POSTGRES_USER=apartment -e POSTGRES_DB=apartment -e POSTGRES_PASSWORD=isolated_coverage_only postgres:16-alpine >/dev/null
ready=false
for _ in $(seq 1 40); do
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete' && docker exec "$name" pg_isready -U apartment -d apartment >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
[[ "$ready" == true ]]
port="$(docker port "$name" 5432/tcp | cut -d: -f2)"
export DATABASE_URL="postgresql://apartment:isolated_coverage_only@127.0.0.1:$port/apartment"
export NODE_ENV=development HOST=127.0.0.1 PORT=8088 COOKIE_SECURE=false WEB_ORIGIN=http://localhost:5173
export LINE_CHANNEL_ID=isolated-coverage-no-provider LINE_OUTBOUND_MODE=disabled LINE_WORKER_MODE=observe LINE_WORKER_APPROVED=false
export LINE_MESSAGING_CHANNEL_SECRET=00000000000000000000000000000000 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=synthetic-no-provider
export LINE_OA_BOT_USER_ID=U8e742f61d673b39c7fff3cecb7536ef0 SUPER_ADMIN_LINE_USER_ID=coverage-bootstrap-never-a-real-user
export EVIDENCE_STORAGE_DRIVER=local EVIDENCE_MALWARE_SCANNER=disabled PAYMENT_EVIDENCE_DIR="$scratch/evidence"
export LINE_GLOBAL_PER_MINUTE=20 LINE_ORG_PER_MINUTE=5
corepack pnpm --filter @apartment/api db:migrate
# Server test harnesses terminate child servers with SIGTERM. Flush V8 before exit.
printf '%s\n' "process.once('SIGTERM',()=>{require('node:v8').takeCoverage();process.exit(0)});" > "$scratch/flush.cjs"
export NODE_OPTIONS="--require=$scratch/flush.cjs"
cat > "$scratch/run.sh" <<'RUN'
set -euo pipefail
cd "$APARTMENT_COVERAGE_ROOT/apps/api"
node --import tsx scripts/check-db-schema-compatibility.ts
for script in smoke smoke-staff smoke-independent-security smoke-load-gates smoke-http smoke-payment-concurrency smoke-financial-adjustments smoke-maintenance smoke-billing-batch smoke-deposits smoke-meter-evidence smoke-operation-notifications smoke-line-oa smoke-line-consent smoke-storage-s3 smoke-evidence-cleanup; do
 echo "RUNNING_IN_ISOLATED_DB $script"
 node --import tsx "scripts/$script.ts"
done
RUN
export APARTMENT_COVERAGE_ROOT="$ROOT"
if [[ -n "${APARTMENT_FOCUSED_SMOKE:-}" ]]; then
 case "$APARTMENT_FOCUSED_SMOKE" in smoke-billing-batch|smoke-deposits|smoke-meter-evidence|smoke-operation-notifications);; *) echo INVALID_FOCUSED_SMOKE >&2; exit 2;; esac
 (cd apps/api && node --import tsx "scripts/$APARTMENT_FOCUSED_SMOKE.ts")
 echo FOCUSED_POSTGRES_SMOKE_PASS
 exit 0
fi
if [[ "${APARTMENT_POSTGRES_BROWSER:-0}" != only ]]; then
 corepack pnpm exec c8 --all --src apps/api/src --include 'apps/api/src/**/*.ts' --extension .ts --check-coverage --lines 80 --reporter=text-summary --reporter=json-summary --reports-dir "$ROOT/coverage/postgres" --temp-directory "$ROOT/coverage/postgres/tmp" bash "$scratch/run.sh"
 echo POSTGRES_HTTP_COVERAGE_PASS
fi

if [[ "${APARTMENT_POSTGRES_BROWSER:-0}" == 1 || "${APARTMENT_POSTGRES_BROWSER:-0}" == only ]]; then
 export WEB_ORIGIN=http://127.0.0.1:4174
 export VITE_LIFF_ID=''
 # Fresh API per viewport isolates rate-limit budgets; production limits stay enabled.
 for project in postgres-desktop postgres-mobile-390 postgres-mobile-320; do
  corepack pnpm exec playwright test --config playwright.postgres.config.ts --project "$project"
 done
 echo POSTGRES_BROWSER_WORKFLOWS_PASS
fi
