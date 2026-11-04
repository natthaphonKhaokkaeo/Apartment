# Apartment CI — PR quality + disposable PostgreSQL security gates

**Scope:** DEV only. The workflow at `.github/workflows/ci.yml` runs on PRs to `main`, pushes to `main`, and manual dispatch. No deploy action or privileged GitHub permission is granted.

## Jobs

- **quality:** Node 24, pinned Corepack 0.34.2, repository-pinned pnpm 12.16.1, frozen lockfile install, commit whitespace check, monorepo unit tests, TypeScript, Web production build. LIFF build argument is blank; no real external authentication is attempted.
- **postgres-security:** Disposable PostgreSQL 16 container per GitHub Actions job, schema migration from checked-in Drizzle migrations, smoke for authenticated organization isolation, STAFF and invitation scopes, meter write race, billing load/idempotency/overflow, PDF/bank/finance HTTP, maintenance, LINE webhook/consent and private-evidence S3 **mock**. No external LINE delivery, bank action, or real S3 credentials are used.

## Safety

- `permissions: contents: read` only; no repository write or deployment credentials in CI.
- Independent isolated database with a dedicated CI-only password. No access to the VPS runtime DB, Docker socket, object storage, or real tenant data.
- `NODE_ENV=development` **only in the disposable CI PostgreSQL integration job** so the existing loopback-only S3 mock is permitted. This does **not** enable production runtime. LINE outbound is disabled, worker approval false.
- GitHub Actions concurrency cancels obsolete runs per PR/ref to avoid waste.
- No Playwright, coverage or linter is yet installed. This is a **partial P7-02 gate**, not a completed 80% coverage or browser acceptance claim. Add those after selecting tooling and stabilizing a real browser test account.

## Verification and rollout

Local checks: `python3` YAML parse, API `typecheck`, Web `build`, API unit tests and isolated security smoke. **GitHub-hosted execution is not verified until a remote run is observed**. Before marking CI as accepted, confirm both jobs pass on a fresh pull request and inspect any migrations failing from an empty database.

Any CI false positive must be fixed by changing the source/test configuration. Do not bypass failing tests or use no-verify flags.

## Longer P1-05 acceptance

Existing P1-05 smoke includes 16 same-key idempotent invoice issues, 16 unique-key conflicts, and 64-way bounded preview. Additional Independent QA covers 16 same-value meter writes, 48 mixed-scope reads, and revoked session/property grants. Remaining: a monitored soak using controlled non-production QPS, measured p95/p99, resource/DB lock profiles, explicit SLO thresholds, and independent manual security review. Do not equate bounded smoke with stress or production acceptance.
