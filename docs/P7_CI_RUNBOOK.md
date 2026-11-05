# Apartment CI — PR quality + disposable PostgreSQL security gates

## 2026-11-05 Browser/P5 hardening addendum

The quality job installs Chromium via Playwright and executes 27 frontend E2E cases across Desktop, Mobile 390px and Mobile 320px after the Vite build; all `/v1/*` routes are mocked, never using LINE credentials or changing DB records. See `docs/P7_BROWSER_E2E_RUNBOOK.md`. Lint now fails on any warning. The disposable PostgreSQL job also runs `smoke:billing-batch`: owner scope, hash/idempotency, meter-change stale preview, immutable invoice line totals and 5 concurrent approval replays. Isolated local execution PASS. Reconcile the remote CI outcome after these files are actually committed/pushed; a local pass is not GitHub Actions evidence.


**Scope:** DEV only. The workflow at `.github/workflows/ci.yml` runs on PRs to `main`, pushes to `main`, and manual dispatch. No deploy action or privileged GitHub permission is granted.

## Jobs

- **quality:** Node 24, pinned Corepack 0.36.0 (required for pnpm 12 native binary layout), repository-pinned pnpm 12.16.1, frozen lockfile install, pnpm audit (block High/Critical), commit whitespace check, ESLint, measured Vitest unit coverage, monorepo unit tests, TypeScript and Web production build. LIFF build argument is blank; no real external authentication is attempted.
- **postgres-security:** Disposable PostgreSQL 16 container per GitHub Actions job, schema migration from checked-in Drizzle migrations, smoke for authenticated organization isolation, STAFF and invitation scopes, meter write race, billing load/idempotency/overflow, PDF/bank/finance HTTP, maintenance, LINE webhook/consent and private-evidence S3 **mock**. No external LINE delivery, bank action, or real S3 credentials are used.

## Safety

- `permissions: contents: read` only; no repository write or deployment credentials in CI.
- Independent isolated database with a dedicated CI-only password. No access to the VPS runtime DB, Docker socket, object storage, or real tenant data.
- `NODE_ENV=development` **only in the disposable CI PostgreSQL integration job** so the existing loopback-only S3 mock is permitted. This does **not** enable production runtime. LINE outbound is disabled, worker approval false.
- GitHub Actions concurrency cancels obsolete runs per PR/ref to avoid waste.
- ESLint and Vitest V8 coverage are installed and executed; **API line coverage is only 29.28%** and domain branch coverage 74.35%. ESLint currently reports 0 errors and 37 warnings. No Playwright test account/browser acceptance yet. This is **partial P7-02**, not an 80% coverage or browser acceptance claim. See `docs/P7_DEPENDENCY_AUDIT.md`.

## Drizzle vs PostgreSQL schema compatibility gate (2026-11-04)
After the disposable CI database migration, `postgres-security` runs `corepack pnpm --filter @apartment/api exec tsx scripts/check-db-schema-compatibility.ts`. It compares expected Drizzle table/column names to `information_schema.columns`, exits nonzero when any are absent, and **never performs schema changes**. This catches schema-code drift before the HTTP smoke suite. Locally, the current shared working tree intentionally reports 17 gaps from another session's uncommitted migration `0017`; do not apply it to DEV from this check. The YAML step ordering and four unit tests have been verified locally; **GitHub hosted run for this change remains unverified** until the change is deliberately committed and pushed. It does not substitute for migration rollback drills or 80% coverage.

## 2026-11-04 disposable PostgreSQL validation
On VPS, launched a unique temporary PostgreSQL 16-alpine Docker container bound to a random loopback host port, set a synthetic test-only DATABASE_URL, ran checked-out Drizzle migrations through current uncommitted 0017 and the new read-only compatibility preflight. Both PASS, checked 335 columns with zero missing. Container cleanup was installed with shell EXIT trap and run; no live DEV migration or shared services touched. The GitHub-hosted CI run for this uncommitted workflow change is still pending; a clean-install test is not proof of rollback or safe migration on existing tenant data.

## Coverage regression gate (November 4, 2026)
The quality job now uses Vitest line coverage thresholds in both workspaces. Domain is gated at **≥80%** (measured **100%**). API is temporarily gated at **≥29%** (measured **29.34%**), to fail regressions without incorrectly claiming the final project goal **≥80%** has been reached. Both thresholded commands passed on VPS. The API target remains a blocker until meaningful HTTP/integration tests raise line coverage to at least 80%; increase the API threshold accordingly. This GitHub workflow change is still uncommitted and no remote workflow run is claimed.

## 2026-11-04 due reminder test increment
Eight new service tests cover due-reminder finance/queue/consent boundaries without external sends, and a failing test exposed non-finite/fractional `limit` acceptance; service now rejects invalid integers. API V8 line coverage rose 29.34% to **30.19%**, and the temporary CI no-regression floor was raised from 29% to **30%**. Final meaningful **80% API** line coverage still OPEN; do not equate this floor with acceptance.

## 2026-11-04 predecessor security-gate improvement
Added seven P1-01 move-out transaction denial tests that validate failed authorization/state before any writes, including owner membership, lease and room state, and missing final water/electric readings. API line coverage measured **31.15%** (1497/4805); CI temporary no-regression floor raised to **31%**. Final API **≥80%** coverage and independent HTTP/browser acceptance remain open. No production/provider operation performed.

## 2026-11-04 backup script syntax gate
The CI quality job now validates backup and offsite ship/retrieve bash syntax (`infra/backup-apartment-postgres.sh`, isolated recovery rehearsal, encrypted offsite upload, encrypted retrieve and negative integration check script). The root-only local `infra/tests/offsite-apartment-postgres.test.sh` has six fail-closed/no-upload checks that pass on VPS; CI syntax checks do not prove offsite transfer. The actual cloud remote and age identity must be set up and tested separately before closing P0/P7 disaster recovery acceptance. See `docs/OFFSITE_BACKUP.md`.

## Verification and rollout

Local checks: YAML parse, API/domain Unit Tests, ESLint, V8 coverage, `typecheck`, Web `build`, clean migration snapshot, isolated security soak and dependency audit. **GitHub Actions run 41750529389 (commit `c908f1c`) passed both jobs on GitHub-hosted runners**, including a clean disposable PostgreSQL 16 migration and all API smoke suites. The later coverage/lint/audit/override job also passed on GitHub Actions Run 41751709175 (commit `f9c9e54`); branch-protection Required Checks are still pending.

Any CI false positive must be fixed by changing the source/test configuration. Do not bypass failing tests or use no-verify flags.

## Longer P1-05 acceptance

Existing P1-05 smoke includes 16 same-key idempotent invoice issues, 16 unique-key conflicts, and 64-way bounded preview. Additional Independent QA covers 16 same-value meter writes, 48 mixed-scope reads, and revoked session/property grants. A limited controlled 60-second 1-RPS authorization soak with p95/p99, sampled API RSS and PostgreSQL connection counts also passed (see `docs/P1_P105_SOAK.md`). Remaining: approved higher-throughput/longer soak with complete DB-lock telemetry, explicit SLO thresholds, and independent manual security review. Do not equate bounded smoke with stress or production acceptance.
