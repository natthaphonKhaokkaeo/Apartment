# P7 LINE Reservation Cleanup — Isolated Security Regression

Verified on 2026-11-04 (DEV checkout).

## Additional test
`apps/api/tests/line-reservation-cleanup-security.test.ts` adds four mocked-DB tests without network or mutation of live DEV data:

1. Invalid organization IDs, retention windows, batch limits and timestamps fail before any DB call.
2. Default is DRY_RUN even when eligible rows exist; no delete is issued.
3. APPLY with zero candidates avoids the DELETE query entirely.
4. APPLY uses a bounded candidate query and reports actual returned deletion count rather than assuming all candidates were removed.

## Verified
- API + domain unit tests: **194/194 PASS**, 42 API suites.
- `corepack pnpm typecheck`: PASS.
- `corepack pnpm lint`: PASS, 0 errors and 5 warnings.
- `corepack pnpm coverage:api`: **40.36% API lines** (2160/5351), under the final **80%** requirement.
- `git diff --check`: PASS.

## Residual limitations
- This suite uses a mocked Drizzle DB, **not** concurrent real PostgreSQL deletion, race tests or an authorization HTTP test.
- P4 live LINE-provider delivery and P7 coverage/security/pentest/browser acceptance remain open.
- Concurrent uncommitted changes in the shared working tree must be reviewed separately. No migration, deploy, commit or push performed by this QA test.
