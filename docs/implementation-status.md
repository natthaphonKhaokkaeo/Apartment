# Apartment implementation status — 2026-11-03

`docs/PHASES.md` is the canonical plan and handoff. This file is a short mirror; do not maintain a second checklist here.

## Current state

- DEV implementation through P5 maintenance tickets and room maintenance transitions is deployed in the existing Dokploy Compose project; migration 0016 is applied.
- P1-05 input/storage bounds and PostgreSQL HTTP concurrency gates pass. The 76-request isolated DEV smoke passed negative/fraction/overflow, duplicate meter, cross-org denial, 16-way same-key replay, 16-way distinct-key race and 32-way preview burst; p95 was 395/282/275 ms; a separated 64-way preview burst also returned 64/64 HTTP 200 (p95 608 ms). A separate 2026-11-03 Independent QA script tested 16 duplicate meter writes (1 success, 15 conflicts), 48 concurrent scoped reads, 5/5 post-revocation write denials, revoked session/disabled account, with overall p95 381 ms; API 76/76 unit tests and typecheck passed. See `docs/P1_P105_INDEPENDENT_QA.md`. Keep P1-05 open for longer monitored soak, threat-model review, coverage/CI and final external security/load acceptance.
- P5 maintenance PostgreSQL/HTTP smoke passes owner/tenant scope, approved lease binding, history visibility, ordered transitions, audit and return-from-maintenance gate.
- Unit tests: domain 11/11 and API 76/76; monorepo typecheck and Web production build pass. Backup `apartment-20261103T153805Z-25493.dump` SHA verification and isolated restore test passed before rollout. Migration 0016 applied; database has 31 public base tables.
- Existing Dokploy Compose API/Web/LINE observer are healthy. Public HTTPS home and `/readyz` return 200; unauthenticated maintenance endpoint returns 401. Worker remains observe-only (`LINE_WORKER_APPROVED=false`, outbound disabled), observed dispatched=0. No LINE messages were sent.
- Public TLS currently works, but shared Traefik ACME persistence/renewal remains unverified; do not restart shared Traefik during Apartment maintenance. Full external readiness still requires LINE/LIFF, bank-app QR recipient confirmation, live S3/ClamAV controls, legal/tax review, offsite backup, independent security/load review and Production acceptance.

## Completed implementation

P0 foundation; P1-01a move-out, P1-02 effective-dated property rates, P1-03a/b room rates and partial billing, P1-03c meter replacement and partial move-out, P1-04 property staff access; P2 invite/claim/approval portal; P3 DEV payment claims, ledger, financial review, PromptPay QR builder, private/S3-mock evidence workflow and non-tax Billing Notice PDF; P4 signed webhook/outbox, tenant consent, observe-only operations, quotas, alerts and reservation retention.

These are DEV implementations. Their provider, legal, financial, reliability, load, or Production gates remain open where listed in `docs/PHASES.md`.

## P7-02 CI groundwork (2026-11-04)
- [x] New `.github/workflows/ci.yml` with read-only GitHub permission, PR-scoped concurrency, Node 24, pinned Corepack + pnpm from lockfile, Drizzle snapshot validation, monorepo unit/typecheck/Web build and disposable PostgreSQL 16 migration + tenant/staff/invoice/payment/maintenance/LINE/S3-mock HTTP smoke. See `docs/P7_CI_RUNBOOK.md`.
- [x] Locally YAML parsed and environment fail-closed guards verified, API 76/76 unit tests, domain unit tests, TypeScript and Web production build PASS; `drizzle-kit check` PASS.
- [ ] GitHub Actions remote jobs have not yet been observed passing; branch-protection, real lint, 80% coverage and Playwright browser E2E still pending.
- [ ] Concurrent P5 Bulk Billing uncommitted schema adds `invoices.billing_batch_run_id`; direct HTTP smoke against DEV migration 0016 responded 500 due missing column. This is schema drift from separate WIP (0017 not applied), NOT a deployed P1-05 regression. Do not apply pending migration or alter P5 working files from this CI session.

## Next work

1. Run a larger bounded load profile and independent security/load acceptance for P1-05.
2. Continue deposits, settlement, bulk billing and tenant operations; P5 maintenance workflow is deployed and smoke-verified.
3. Keep LINE/LIFF, bank, S3/ClamAV, legal/tax, offsite backup and Production acceptance open until their required credentials, decisions and external verification exist.

Never treat a manual payment approval as bank-verified funds, issue an official receipt/tax invoice without legal approval, or enable live LINE sending from the DEV observer.
