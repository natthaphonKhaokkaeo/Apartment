#!/usr/bin/env bash
# Finite DEV quality gate. PostgreSQL mutations are confined to the disposable runner.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
corepack pnpm test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm coverage:domain
corepack pnpm --filter @apartment/api exec vitest run --coverage --coverage.include='src/**/*.ts' --coverage.reporter=text-summary --coverage.thresholds.lines=39
corepack pnpm audit --audit-level high
corepack pnpm --filter @apartment/api exec drizzle-kit check
corepack pnpm test:e2e
APARTMENT_POSTGRES_BROWSER=1 bash infra/test-api-postgres-coverage.sh
git diff --check
echo APARTMENT_DEV_AUTOMATED_GATES_PASS
