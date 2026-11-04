# Apartment CI — PR quality + disposable PostgreSQL security gates

**Scope:** DEV only. The workflow at `.github/workflows/ci.yml` runs on PRs to `main`, pushes to `main`, and manual dispatch. No deploy action or privileged GitHub permission is granted.

## Jobs

- **quality:** Node 24, pinned Corepack 0.36.0 (required for pnpm 12 native binary layout), repository-pinned pnpm 12.16.1, frozen lockfile install, pnpm audit (block High/Critical), commit whitespace check, ESLint, measured Vitest unit coverage, monorepo unit tests, TypeScript and Web production build. LIFF build argument is blank; no real external authentication is attempted.
- **postgres-security:** Disposable PostgreSQL 16 container per GitHub Actions job, schema migration from checked-in Drizzle migrations, smoke for authenticated organization isolation, STAFF and invitation scopes, meter write race, billing load/idempotency/overflow, PDF/bank/finance HTTP, maintenance, LINE webhook/consent and private-evidence S3 **mock**. No external LINE delivery, bank action, or real S3 credentials are used.

## Safety

- `permissions: contents: read` only; no repository write or deployment credentials in CI.
- Independent isolated database with a dedicated CI-only password. No access to the VPS runtime DB, Docker socket, object storage, or real tenant data.
- `NODE_ENV=development` **only in the disposable CI PostgreSQL integration job** so the existing loopback-only S3 mock is permitted. This does **not** enable production runtime. LINE outbound is disabled, worker approval false.
- GitHub Actions concurrency cancels obsolete runs per PR/ref to avoid waste.
- ESLint and Vitest V8 coverage are installed and executed; **API line coverage is only 29.28%** and domain branch coverage 74.35%. ESLint currently reports 0 errors and 38 warnings. No Playwright test account/browser acceptance yet. This is **partial P7-02**, not an 80% coverage or browser acceptance claim. See `docs/P7_DEPENDENCY_AUDIT.md`.

## Verification and rollout

Local checks: YAML parse, API/domain Unit Tests, ESLint, V8 coverage, `typecheck`, Web `build`, clean migration snapshot, isolated security soak and dependency audit. **GitHub Actions run 41750529389 (commit `c908f1c`) passed both jobs on GitHub-hosted runners**, including a clean disposable PostgreSQL 16 migration and all API smoke suites. The later addition of coverage/lint/audit/overrides requires a new remote run after its commit; branch-protection Required Checks are still pending.

Any CI false positive must be fixed by changing the source/test configuration. Do not bypass failing tests or use no-verify flags.

## Longer P1-05 acceptance

Existing P1-05 smoke includes 16 same-key idempotent invoice issues, 16 unique-key conflicts, and 64-way bounded preview. Additional Independent QA covers 16 same-value meter writes, 48 mixed-scope reads, and revoked session/property grants. A limited controlled 60-second 1-RPS authorization soak with p95/p99, sampled API RSS and PostgreSQL connection counts also passed (see `docs/P1_P105_SOAK.md`). Remaining: approved higher-throughput/longer soak with complete DB-lock telemetry, explicit SLO thresholds, and independent manual security review. Do not equate bounded smoke with stress or production acceptance.
