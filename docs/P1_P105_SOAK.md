# P1-05 Sustained property-scope verification — DEV only

## Design

Script: `apps/api/scripts/soak-security.ts` (no deployment, no background service). Spawns one isolated API bound to random `127.0.0.1` port. Creates isolated organizations, one STAFF VIEWER membership, one property grant and a room in dedicated Apartment DEV PostgreSQL. Alternates authorized and cross-organization room reads at a deliberately bounded 1 request/sec, below the API's global IP rate limit of 90 per minute. Checks safe output fields and every HTTP status. Samples API RSS from Linux `/proc` and PostgreSQL connections without inspecting tenant data; deletes only synthetic rows after the test.

The process overrides child settings to `LINE_OUTBOUND_MODE=disabled`, `LINE_WORKER_MODE=observe` and `LINE_WORKER_APPROVED=false`. It does not send LINE, transfer money, create invoices, or access externally hosted endpoints.

## Reproduce

```bash
cd /root/Projects/Apartment
P105_SOAK_SECONDS=60 corepack pnpm --filter @apartment/api exec tsx scripts/soak-security.ts
```

Allowed `P105_SOAK_SECONDS`: 10–120 seconds. Do not run on production, a shared database other than the Apartment DEV database, or during another session's schema migration. This test deliberately uses room read endpoints so it does not rely on the separate uncommitted P5 Bulk Billing 0017 migration.

## Result — November 4, 2026

- Test duration: **60 seconds**; nominal rate **1 request/sec**
- Total requests: **60**, 40 authorized (HTTP 200) and 20 forbidden (HTTP 403)
- Unexpected status / 5xx / timeouts: **0**; tenant/property scope checks: **PASS**
- Latency: p50 **8 ms**, p95 **14 ms**, p99 **36 ms** on this one DEV run
- Sampled isolated API RSS: initial **236 MB**, final **236 MB**, sampled peak **236 MB**
- Maximum observed PostgreSQL connections (whole DEV database; includes test): **4**
- Real LINE sends: **0**
- Additional short preliminary run: 12 requests, all PASS, p95 34 ms

**Limitation:** 60 seconds at 1 RPS is a bounded stability check, not a saturation, production soak, full user-behavior, or SLA test. No numerical SLO has been approved. Final P1-05 gate still needs measured traffic profile, resource/DB-lock observability under higher **approved** load, browser E2E, vulnerability/security review and business sign-off.
