# APARTMENT PLATFORM IMPLEMENTATION REPORT

Date: 2026-11-05, Asia/Bangkok. Scope: current shared Apartment DEV working tree.

## 1. Overall completion

**NOT 100% DEV READY. IMPLEMENTATION IN PROGRESS.** A trustworthy whole-project percentage cannot be derived from the overlapping parent/child checklist until all acceptance items are reconciled. This pass closed local encrypted backup implementation and the local API line-coverage threshold, expanded real backend browser verification and corrected frontend money parsing. Both coding work and external acceptance still remain.

## 2. Phase status

| Phase | Overall status | Verified increment / remaining gate |
|---|---|---|
| P0 | IN_PROGRESS | Local encrypted backup, monitoring and restore are installed and tested; full operational/release acceptance remains |
| P1 | IN_PROGRESS | Real browser organization/property/room/lease flow; DB billing/concurrency suites pass; persisted deposit settlement still needed |
| P2 | IN_PROGRESS | Real DB session expiry/logout and mocked invitations pass; actual LINE Login/LIFF callback/test accounts unverified |
| P3 | IN_PROGRESS | Payment/finance/IDOR/concurrency and S3 mock pass; exact integer satang input fixed; bank/S3/real scanner/refund acceptance open |
| P4 | IN_PROGRESS | Signed webhook/consent/outbox/quotas/revocation DB mocks pass; remaining event producers and approved provider tests open |
| P5 | IN_PROGRESS | Bulk billing, maintenance and selected reports tested; deposit, meter evidence/anomaly review and privacy lifecycle still incomplete |
| P6 | IN_PROGRESS | 3 viewport browser suites pass selected workflows; complete role/workflow/accessibility/UAT acceptance open |
| P7 | IN_PROGRESS | Local API >=80% gate met, domain 100%, lint/types/audit/restore/smoke pass; complete browser/security/load/UAT/remote CI acceptance open |

## 3. Features implemented in this pass

- Same-VPS age-encrypted archival backup, authenticated recovery, SHA-256 checks, root-only storage, flock, retention, freshness and disk checks.
- Daily backup archives through existing systemd service; independent archive catch-up timer; hourly health checks; weekly isolated encrypted restore timer; local OnFailure journal alerts.
- Recovery drill now selects a verified pre-0017 backup rather than attempting to reapply migration 0017 to an already upgraded backup.
- All-source native V8/c8 HTTP coverage across disposable PostgreSQL and actual spawned API servers; >=80% enforced in the new local runner and proposed CI job.
- Real backend browser tests for owner organization/property/room/lease creation, expiry, logout and STAFF server denial.
- Frontend integer satang parser using BigInt; rejects excessive decimals, exponent notation, negatives and overflow. Fourteen regression cases pass.
- Owner membership refresh after organization creation; browser verifies owner label immediately.

## 4. Files changed

Committed backup unit: infra/backup-apartment-postgres.sh, infra/local-archive-apartment-postgres.sh, infra/tests/local-backup-config.test.sh, infra/tests/local-archive-integration.test.sh, eight Apartment systemd service/timer/drop-in files, docs/LOCAL_BACKUP.md.

Committed money unit: apps/web/src/money.ts, the parser import/call in apps/web/src/main.tsx, apps/api/tests/web-money.test.ts.

Additional shared-tree work: infra/test-api-postgres-coverage.sh, playwright.postgres.config.ts, tests/e2e-postgres/workflows.spec.ts, package.json, pnpm-lock.yaml, .github/workflows/ci.yml, owner membership refresh in main.tsx, isolated recovery rehearsal and phase/status/runbook documents. These depend on existing uncommitted feature code and remain uncommitted. Other sessions' files are preserved.

## 5. Tests and coverage

| Command / scope | Actual result |
|---|---|
| corepack pnpm test | API 214/214; Domain 15/15 PASS |
| corepack pnpm coverage:domain | 100% lines, 69/69; 96.42% branches |
| unit-only API V8 | 40.38% lines, 2161/5351 before adding frontend parser tests |
| bash infra/test-api-postgres-coverage.sh | all 13 isolated smoke scripts + schema compatibility PASS; c8 lines 85.84%, 5069/5905; >=80% gate PASS |
| c8 source inclusion | all 60 API source files included, zero omitted |
| APARTMENT_POSTGRES_BROWSER=only bash infra/test-api-postgres-coverage.sh | 12/12 real backend browser cases PASS, 4 per viewport |
| corepack pnpm test:e2e | latest current-tree mock suite 33/33 PASS following production Web build |
| corepack pnpm typecheck | PASS |
| corepack pnpm lint | PASS, zero warnings |
| corepack pnpm audit --audit-level high | PASS at requested severity; 6 Moderate advisories remain |

Vitest and c8 report different source-line denominators; their numbers are not merged or represented as identical metrics. The c8 measurement covers real HTTP servers and DB workflows; source files were not excluded to raise coverage. Machine-readable evidence: docs/verification/api-postgres-coverage-2026-11-05.json. Coverage and browser evidence apply to the current shared working tree, not only committed HEAD. The expanded GitHub workflow has not been pushed or remotely verified.

Transient command logs: /tmp/apartment-current-tests.log, /tmp/apartment-current-domain.log, /tmp/apartment-current-coverage.log, /tmp/apartment-postgres-coverage.log, /tmp/apartment-current-e2e.log, /tmp/apartment-postgres-browser-only.log, /tmp/apartment-current-audit.log. Reproduce using the commands above; local logs are not durable audit storage.

## 6. Security findings

- No High/Critical dependency advisory was reported; 6 Moderate remain untriaged.
- CSRF correctly rejected browser tests when their origin differed from WEB_ORIGIN; test configuration was corrected. CSRF and rate limits remain enabled.
- Fresh API processes per viewport isolate browser rate budgets; no rate-limit bypass was added.
- STAFF browser fixture receives 200 on granted rooms and 403 on direct financial invoice access.
- No administrator is created through a client-supplied LINE identity. Test sessions exist only in the disposable PostgreSQL runner.
- Production evidence scanning is not accepted: deployed DEV uses local private evidence and malware scanner disabled (NOT SCANNED).
- No external LINE messages, bank transfers, production deployment or live database restore occurred.

## 7. PostgreSQL migrations

Clean disposable PostgreSQL migrations through current 0017 and read-only Drizzle compatibility checks pass. The pre-0017 upgrade rehearsal passes five selected table-content fingerprints, then restores the original disposable backup. The source DEV DB is only read by pg_dump/metadata checks; no migration was applied to the live DB by this pass. This is backup-based recovery, not a lossless in-place downgrade after new writes.

## 8. Backup and restore

All approved local gates passed: LOCAL_BACKUP_PASS (actual BACKUP_OK), BACKUP_CHECKSUM_PASS, BACKUP_ENCRYPTION_PASS, BACKUP_RESTORE_DRILL_PASS, MIGRATION_ROLLBACK_DRILL_PASS (actual RECOVERY_DRILL_PASS), BACKUP_RETENTION_PASS and BACKUP_MONITORING_PASS.

Encrypted-only recovery restored 32 public tables without dependence on the source plaintext dump. Corrupt ciphertext, invalid configuration, disk threshold and concurrent lock were tested. Retention removed only an owned expired fixture and preserved the current verified archive. Systemd backup and restore services report Result=success, ExecMainStatus=0. No failed systemd units were observed at the final check.

Schedules, Bangkok: daily backup 03:30, archive catch-up 03:45, health hourly, restore Sunday 05:00. Alerts are local journal/syslog only. All copies reside on /dev/sda1, so host/disk loss is not covered. Private identity is root-only outside Git at /etc/apartment/backup-age.key; operator export/custody remains unconfirmed. See LOCAL_BACKUP.md.

## 9. LINE integration

DEV API has LINE channel/bot/secret/token variables configured, but this does not prove provider validity or acceptance. Actual settings remain LINE_OUTBOUND_MODE=disabled, LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false. Signed webhook/consent/deduplication/quotas/retry/revocation tests use mocks. Real LIFF/browser callback, approved test identities and bounded provider dispatch are unverified.

## 10. Payment integration

Integer satang financial rules, manual-ledger authorization, partial/full payment, replay/concurrency and financial adjustment smoke tests pass. Slip upload does not imply bank-confirmed funds. S3 tests are mocks; deployed S3 endpoint/access credentials are missing. Local private evidence remains active. Real bank recipient/QR confirmation, real scanner, actual refund/reconciliation and legal document acceptance remain open.

## 11. Dokploy

Existing Apartment DEV API/Web/observe-only worker/PostgreSQL were observed healthy. No application image redeployment was performed in this pass: shared source/CI integration and remaining mandatory workflow gates must be completed first. Local backup infrastructure was installed and exercised. No unrelated service was restarted.

## 12. Public DEV smoke

https://apartme.makemarket.space/ : HTTP 200.
HTTPS /healthz and /readyz : HTTP 200.
Unsigned POST /v1/line/oa/webhook : HTTP 401.
Certificate verification enabled. Smoke rerun after backup changes passes.

## 13. Git

- ec08eb4 — feat(infra): verify encrypted same-VPS PostgreSQL recovery — pushed to origin/main.
- b234065 — fix(web): parse currency into exact integer satang — pushed to origin/main.
- Subsequent configuration/report changes are committed separately when recorded in Git log.
- Previous shared work, .serena data and mixed feature/QA changes remain preserved. No reset, stash, hook bypass or unrelated staging was used.

## 14. External blockers

BLOCKED TASK: Real LINE Login/LIFF and bounded external dispatch acceptance.
WHY: Configured secrets alone do not establish consented sandbox accounts or approval to dispatch.
WHAT IS REQUIRED: Operator-approved test identities/channel setup and explicit bounded-send approval.
WHAT WAS ALREADY IMPLEMENTED: Signature/consent/outbox/retry/rate/revocation tests; disabled observer runtime.
SAFE NEXT ACTION: Finish remaining code and prepare a bounded sandbox acceptance script; keep outbound disabled.

BLOCKED TASK: Real S3/bank/scanner/legal provider acceptance.
WHY: S3 endpoint/credentials absent; bank-recipient/legal acceptance and live scanner drill not verified.
WHAT IS REQUIRED: Approved test storage credentials, bank-app recipient confirmation, scanner operational verification and relevant policy signoff.
WHAT WAS ALREADY IMPLEMENTED: Private local evidence, mock S3 sanitation/replay/IDOR tests, fail-closed scanner adapter and manual financial controls.
SAFE NEXT ACTION: Continue provider-independent code and isolate real-provider tests; never accept uploaded slips as bank verification.

BLOCKED TASK: Operator recovery-key custody.
WHY: Encrypted local recovery passes, but operator-held recovery-key copy has not been confirmed.
WHAT IS REQUIRED: Secure operator export using SSH/SFTP to protected custody, never through chat or Git.
WHAT WAS ALREADY IMPLEMENTED: Root-only key and documented secure export/recovery process.
SAFE NEXT ACTION: Operator follows LOCAL_BACKUP.md; retain existing key and backups.

## 15. Remaining implementation work

This is not an external-dependencies-only finish. Coding remains: persisted deposit ledger/deduction/refund review API and UI; meter photo evidence and persisted anomaly review; remaining invitation/repair notification producers; privacy deletion/retention and contract workflows; broader billing/payment evidence/maintenance/invitation browser integration; full manager/super-admin/accessibility acceptance and remaining load/operational gates. Reconcile each canonical checkbox and commit reviewed coherent shared feature units before deploying new images.

## 16. Readiness classification

| Classification | State |
|---|---|
| IMPLEMENTATION COMPLETE | NO |
| DEV DEPLOYED | Existing application YES; new backup infrastructure YES; expanded shared application work NOT deployed |
| DEV UAT VERIFIED | NO |
| PRODUCTION APPROVED | NO |

Do not declare 100% DEV READY from this report.
