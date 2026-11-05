# P3/P7 Payment release-boundary regression (DEV)

Date: 2026-11-04. Source: `apps/api/tests/payment-release-boundaries.test.ts`.

Four additional unit tests exercise:
- Valid PostgreSQL int4 maximum satang arithmetic, rejection of negative/fractional/non-finite/out-of-range amounts.
- Existing ledger over-approval, zero payment and overpayment.
- Bank number masking (last four digits only) and invalid characters/lengths.
- Transfer-reference canonical uppercase form and rejection of short, control-character, Unicode and malformed references.

Verified against current shared working tree:
- `corepack pnpm test`: 43 API test files, 198 tests passed.
- `corepack pnpm typecheck`: PASS.
- `corepack pnpm lint`: PASS (existing warnings remain).
- `corepack pnpm --filter @apartment/web build`: PASS (large chunk warning).
- `git diff --check`: PASS.

These are focused pure-service tests. They do not verify live payment networks, genuine bank confirmation, PostgreSQL concurrency, data-retention policy, HTTPS callback, S3 malware scanning or production acceptance. All external provider, financial/legal sign-off, independent security review and real-browser gates remain open. This round did not overwrite concurrent WIP, apply migrations, commit, push or deploy.
