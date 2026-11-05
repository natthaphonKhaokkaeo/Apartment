# APARTMENT PLATFORM IMPLEMENTATION REPORT

Updated 2026-11-05. This report supersedes older test counts and uncommitted-work observations. Current deployed source: ce495657c2b77b9d2cf9043c865a4e1450d58438. Privacy/security/browser increment below was committed, pushed and deployed to DEV as 4bdc991 after the local full release gates passed.

## 1. Overall completion

NOT 100% DEV READY. No defensible overall percentage is asserted while canonical phase acceptance items remain open. Selected automated gates passing does not mean every P0–P7 workflow or real provider UAT is complete.

## 2. Phase status

| Phase | Status | Verified implementation and remaining acceptance |
|---|---|---|
| P0 | IN_PROGRESS | Local encrypted PostgreSQL backup, timers, freshness/retention/checksum/restore and migration rehearsal implemented; complete operational acceptance and recovery-key custody evidence remain |
| P1 | IN_PROGRESS | Rooms/leases/rates/meter replacement/billing/concurrency, deposit receipts and two-owner deduction/review deployed; manual refund reconciliation and reservation resolution remain |
| P2 | IN_PROGRESS | Backend identity/session/invitation tests, actual DB logout/expiry and trusted owner linking implemented; new profile-link race fix under release validation; real LINE/LIFF account callback UAT remains |
| P3 | IN_PROGRESS | Private sanitized evidence, manual ledger verification, financial adjustments and duplicate/concurrency protection; synthetic actual-backend payment browser passes; real bank/scanner/storage acceptance remains |
| P4 | IN_PROGRESS | Webhook HMAC/dedupe, consent, outbox/retry/quota/dead-letter monitoring and maintenance producer; invitation producer deliberately ineligible under v1 purpose; real dispatch approval/UAT remains |
| P5 | IN_PROGRESS | Bulk billing, maintenance lifecycle, reports, exports, deposit/meter evidence and anomaly review deployed; profile requests/review added to candidate; attachments/SLA/contract/complete retention remain |
| P6 | IN_PROGRESS | Responsive owner/staff/tenant workflows at desktop/390/320; new profile UI and Manager action guard in candidate; complete accessibility/workflow/operator/design acceptance remains |
| P7 | IN_PROGRESS | Genuine all-file PostgreSQL API coverage >=80%, domain100%, lint/types/security/concurrency, CI, backup/recovery and public smoke verified for deployed release; candidate full gates and real provider UAT tracked separately |

## 3. Features implemented

Deployed release includes integer-satang frontend parsing, scoped owner/staff/tenant APIs, immutable invoicing, concurrent bulk billing, private sanitized meter photos, persisted owner anomaly assessments, immutable manual deposit receipts, distinct active OWNER review/deductions, consent-bound generic repair notifications and fail-closed invitation notification purpose.

Candidate adds owner-scoped summary-only maintenance SLA reporting (overdue, due-soon, missing-deadline and status counts, without tenant description exposure), sanitized private maintenance image attachments (malware scan, metadata strip, PostgreSQL storage, strict ticket/property authorization, audit and no-store download), own profile request/cancellation, trusted platform-admin review and explicit profile-only acknowledgement; default-disabled server policy gate; synthetic guarded profile anonymization preserving financial records; serialized account disable vs tenant approval; active OWNER/account/organization recheck on approval; Manager UI restriction; actual backend maintenance/payment/profile browser scenarios. Actual profile erasure is not enabled or executed on DEV.

## 4. Files changed

Deployed integration dbf889a changed 132 files; ce49565 fixes production React build environment in CI. Candidate files: API config/schema/index, routes/privacy-requests.ts and routes/tenant.ts, services/privacy-policy.ts and privacy-requests.ts, privacy policy/config tests and invitation HTTP fixtures, migration0020 + metadata, two disposable privacy smoke scripts, PrivacyCenter/TenantPortal/OwnerInvitations/main frontend files, backend Playwright workflows, disposable QA runner, .env.example and status/runbook/evidence documents. `.serena/` is unrelated and preserved.

## 5. Tests and coverage

Deployed ce49565 evidence: API unit244/244, domain15/15; domain lines100%; API unit-only lines40.49% (2325/5741), retained >=39 regression floor; genuine HTTP/PostgreSQL c8 lines87.03% (5500/6319), all65 API files; mocked browser33/33; real-backend browser12/12; public guest browser3/3. GitHub Actions41948158755 both jobs SUCCESS.

Candidate full release gates PASS: unit262/262 (49 files); domain15/15/100%; API unit-only40.08% (2374/5923), above the 39% regression floor; genuine PostgreSQL HTTP c8 coverage87.41% (5691/6510) across all68 API files; mocked browser33/33; real-backend browser24/24 (8 workflows × desktop/390/320), including maintenance, payment evidence/owner approval, privacy submit/cancel and Manager restrictions. TypeScript, ESLint zero warnings, dependency audit with zero critical/high (6 moderate advisories documented), migration check, financial/concurrency/privacy smoke suites, secret scan and isolated migration rollback rehearsal PASS. Full run log: .qa-output/release-current.log; focused Manager viewport log: .qa-output/manager-browser.log.

## 6. Security findings

Fixed stale tenant identity linking during concurrent account disable, and required active OWNER/account/organization inside the approval transaction. Profile actions are subject-scoped or platform-admin-only, no-store, strict request schema, idempotent and audited. Protected accounts, active owner roles, unended leases, pending claims and policy retention block execution. No immutable invoice, payment ledger, evidence or backup is erased by profile execution.

Audit: 0 critical, 0 high, 6 moderate; see verification/dependency-audit-2026-11-05.md. Moderate advisories remain open. Real scanner and storage/provider security acceptance remain separate. No secrets/private recovery key are committed.

## 7. PostgreSQL migrations

Live deployed schema:20 migrations through0019,36 public tables. Candidate0020 creates privacy_requests and indexes/FKs; migration check and isolated full upgrade/rollback rehearsal PASS, restoring all36 original table fingerprints. Migration0020 was applied by DEV deployment; pre-deploy isolated upgrade/rollback and fingerprint restoration passed. Deployment smoke reported DEV_MIGRATIONS_AND_OBSERVER_SAFE_PASS.

## 8. Backup and restore

Approved same-VPS source /root/backups/apartment-postgres and age-encrypted archive /root/backups/apartment-local-archive. Root-only directories0700, private recovery key0600 outside Git. Daily backup03:30 BKK, archive03:45, hourly health and weekly isolated restore timers enabled. SHA-256, authenticated decrypt, locking, freshness/disk checks and safe retention are implemented. Local journal alerts are enabled; external paging is not enabled.

Latest deployed post-migration encrypted-only restore verified36 public tables from apartment-20261105T012829Z-57795.dump. Latest recorded manual health check08:56 UTC+7 returned BACKUP_CHECKSUM_PASS and BACKUP_MONITORING_PASS (disk57%, age1651s). Refer to journal for exact later checks. Same-disk archives do not provide independent host-loss recovery. All restore/rollback drills use disposable containers, never overwrite live PostgreSQL.

## 9. LINE integration

Real read-only Messaging API bot identity preflight returned200 for deployed runtime; LIFF ID build/runtime presence/match verified. Automated webhook/consent/outbox/provider tests use mocks. Actual operator LINE Login/LIFF callbacks remain unverified. Runtime outbound disabled, observer observe-only, approvalfalse; no live messages sent. Existing v1 consent does not authorize invitation notifications.

## 10. Payment integration

Manual owner ledger approvals are not bank-confirmed transactions. Uploaded evidence remains pending until authorized financial review. Genuine backend browser test verifies this transition using synthetic invoices/bank details/evidence in disposable PostgreSQL. No real payment/refund or bank transfer is performed. Recipient/bank/scanner/real private object-storage UAT remains open.

## 11. Dokploy deployment

Existing Apartment DEV Compose project apartment-dokploy-dev-ajcnbm, docker-compose.dokploy.yml. ce49565 immutable labelled images built from clean Git archive and deployed to API/Web/observe-only worker. All three healthy; PostgreSQL start timestamp unchanged. Shared proxy and unrelated services untouched. Rollback image tags retained20261105T012646Z. Deployment uses the existing managed Compose configuration; no Dokploy API dashboard history update is claimed.

## 12. Public DEV smoke

https://apartme.makemarket.space — deployed release /, /healthz, /readyz200; unsigned webhook401; protected deposit/meter/export/batch paths401 without authentication. Guest browser1280/390/320 passed, no protected navigation or horizontal overflow. Privacy API is deployed; unauthenticated tenant/admin request endpoints return401.

## 13. Git commits and push

main: ec08eb4 local backup; b234065 exact satang;153fad1 recovery evidence; dbf889a integrated verified implementation; ce49565 CI build fix. All pushed. Candidate full local gates passed and is ready for explicit-path staging. Commit, push, CI and DEV deployment are pending; unrelated .serena files remain unstaged.

## 14. External blockers

BLOCKED TASK: Real LINE account/LIFF and external dispatch UAT.
WHY: Read-only bot identity and mocks do not prove account callback, consented delivery or provider behavior.
WHAT IS REQUIRED: Operator-approved LINE test accounts/console callback configuration, bounded delivery approval and UAT evidence.
WHAT WAS ALREADY IMPLEMENTED: Backend token/session verification, callback UI, webhook/consent/outbox/retry/quota/monitoring and mock acceptance.
SAFE NEXT ACTION: Keep outbound disabled and run authorized real account UAT once access/approval is available.

BLOCKED TASK: Bank/scanner/private object-storage and legal retention acceptance.
WHY: Mock/synthetic acceptance does not prove real recipient/IAM/scanner/legal policy.
WHAT IS REQUIRED: Confirmed bank recipient, actual scanner/storage test environment where required, approved retention and financial/receipt policies.
WHAT WAS ALREADY IMPLEMENTED: Private sanitized evidence, PromptPay builder, manual ledger, fail-closed scanner/provider adapters and guarded default-disabled profile workflow.
SAFE NEXT ACTION: Continue provider-independent implementation; enable no profile erasure, real refund or provider send without applicable approval.

BLOCKED TASK: Operator recovery-key custody evidence.
WHY: Key exists protected on current VPS, but secure operator export/custody has not been confirmed.
WHAT IS REQUIRED: Operator securely exports and verifies custody following LOCAL_BACKUP.md, without posting private key in chat or Git.
WHAT WAS ALREADY IMPLEMENTED: age key0600, encrypted archive verification and isolated restore; same-VPS backup is complete independently of host-loss DR.
SAFE NEXT ACTION: Retain current protected key and backups; operator performs documented secure custody process.

## 15. Remaining code and acceptance

Manual refund reconciliation and approved reservation resolution; maintenance private attachments and configurable SLA/report acceptance; contract and complete data-retention workflows; full browser/operator/accessibility/design acceptance; remaining code workflows; moderate dependency updates. The candidate local full release gates and migration rehearsal now pass. These are not all external blockers. Canonical PHASES.md and P5 runbooks carry task evidence.



## Current post-deploy checkpoint (2026-11-05)

Commit `4bdc99157f9a93d8e019378de4355f5aecb8817f` pushed to `main` and deployed in Dokploy DEV. `DEV_DEPLOY_PASS`; public web/health/readiness returned200; unsigned webhook and unauthenticated tenant/admin privacy routes returned401. API, web and LINE observer containers healthy; PostgreSQL was not restarted. Pre-deploy backup checksum, encryption, retention, monitoring and isolated restore drill passed (36 tables restored, network disabled); privacy migration0020 applied in DEV. Local release gate: unit262/262, domain15/15 (100%), API unit-only40.08%, PostgreSQL HTTP c8 87.41% across68 API files, mock browser33/33, backend browser24/24, lint/typecheck/migration/security gates pass. No push-triggered GitHub Actions run was returned by the connected wrapper; it only exposes PR-triggered runs.

## 16. Final readiness classification

IMPLEMENTATION COMPLETE: NO; remaining code and UAT items are listed in section 15.
DEV DEPLOYED: YES, commit 4bdc991; API/Web/observer healthy, PostgreSQL not restarted.
DEV UAT VERIFIED: PARTIAL; automated workflows pass, real LINE operator callback/UAT is not verified.
PRODUCTION APPROVED: NO.


## Continued code work — 2026-11-05

Added `GET /v1/properties/:propertyId/maintenance-tickets/sla-report`. It reuses the property authorization gate, returns aggregate counts only, and sets `Cache-Control: private, no-store`. Red/green unit test passed; PostgreSQL smoke verifies owner access, cross-property403 and tenant403. Full current verification: API unit tests263 passed; PostgreSQL HTTP coverage87.45% (5715/6535); mocked browser33/33; real-backend browser24/24; TypeScript and ESLint pass. This delta was committed as `ab37dac` and deployed to DEV; API/Web/observer are healthy, public SLA route denies unauthenticated access with401, and PostgreSQL was not restarted. Business-configured SLA policy and legally approved retention remain open; maintenance attachment upload/download code is implemented and verified.


## Latest deployment checkpoint — 2026-11-05

`ab37dac` is deployed to Dokploy DEV. SLA report route returns401 unauthenticated; API/Web/observer healthy. Deploy gate passed; PostgreSQL was not restarted. Pre-deploy local encrypted backup/restore drill restored37 public tables with network disabled. The just-finished gates: unit263/263, domain15/15, PostgreSQL API line coverage87.45%, mock browser33/33 and real-backend browser24/24. The code backlog remains open, including private maintenance attachments and other phase tasks; no 100% completion claim.


## Maintenance attachment continuation — 2026-11-05

Added migration `0021_misty_storm`, private image attachment persistence and scoped upload/list/download endpoints for tenant and property users. Uploads are malware-scanned, re-encoded to WebP, metadata-stripped, bounded at2MB and five per ticket, stored in PostgreSQL bytea and audited. Download is authenticated, `private, no-store` and `nosniff`; tenant access is tied to the reporting user, owner/staff access to authorized property + ticket. Real-browser upload/download passed at desktop,390px and320px. Latest gates: unit263/263 + domain15/15, PostgreSQL API line coverage87.6%, mock browser33/33, real-backend browser24/24, lint/typecheck, migration rollback and PostgreSQL smoke pass. Code is ready for commit/deploy; final retention policy remains a separate product/legal requirement.
