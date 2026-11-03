# P1-05 Independent security and bounded concurrency QA (DEV)

Date: 2026-11-03. Environment: dedicated Apartment DEV PostgreSQL; short-lived API bound to a randomly allocated `127.0.0.1` port. Does **not** use the live public URL, LINE, banking, or any third-party service.

## Purpose

Add an independent, repeatable security pass alongside the existing P1-05 billing concurrency tests. It focuses on the *authorization boundary* and the *revoke-versus-write invariant*, not just billing arithmetic. The script uses synthetic users, sessions, organizations, properties, rooms, and a property-scoped METER_READER grant. It records all created IDs and cleans up only those fixtures.

## Run

```bash
cd /root/Projects/Apartment
corepack pnpm --filter @apartment/api exec tsx scripts/smoke-independent-security.ts
corepack pnpm --filter @apartment/api test
corepack pnpm --filter @apartment/api typecheck
```

Do not run during database migration, major production maintenance, or while another test is intentionally locking the same resources. Dedicated DEV data is used and fixtures are disposable; verify that the source database is the Apartment DEV database before executing.

## Verified scenario

1. STAFF METER_READER can read assigned rooms, while same-organization ungranted property and foreign-organization property both return 403.
2. Safe room response does not disclose rental override fields; finance, lease, overview and bill preview remain forbidden to STAFF.
3. Unauthenticated and forged session cookies return 401; incorrect Origin and negative/oversized/fractional meter values are rejected.
4. Sixteen concurrent identical meter reading writes: exactly one 201 Created; fifteen 409 Conflict; exactly two stored readings including the setup reading.
5. Bounded 48-request parallel mixed-scope burst: all authorized reads 200, all unauthorized reads 403, no cross-property leak.
6. OWNER revokes STAFF's grant. Five new meter writes and a room read are forbidden after revoke completes.
7. Revoked session and disabled user both lose access with HTTP 401.
8. All test-originated fixtures are deleted in FK order. No invoice, real rent, bank transaction, or LINE outbound operation is performed.

## Captured result

- Verdict: PASS
- Duplicate writes: 1 created / 15 conflicts
- Mixed-scope parallel HTTP requests: 48 passed
- Post-revocation write denials: 5/5
- Mixed parallel burst elapsed: 315 ms
- Overall HTTP p50: 183 ms; p95: 381 ms
- Maximum in-flight requests during burst: 48
- API Unit Suite: 23 files, 76/76 tests PASS
- API TypeScript: PASS

The p95 values are specific to this single synthetic DEV run. No SLO/SLA claim or throughput extrapolation should be made.

## Unfinished acceptance

P1-05 is **not fully signed off**. Continue with independent threat-model review, duration-based load/soak tests at approved limits, resource consumption/DB locks telemetry, CI gates/coverage, and browser E2E with realistic authorization sessions. Do not close the Production gate solely on synthetic tests.

Do not modify shared Traefik or enable LINE outbound for QA.
