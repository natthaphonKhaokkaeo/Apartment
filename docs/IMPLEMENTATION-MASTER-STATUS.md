# Apartment — Implementation Master Status (DEV, 2026-11-04)

## 2026-11-05 privacy release candidate — QA PASS, deploy pending

- P5-PRIVACY-01 / P6-PRIVACY-01: request, cancel, trusted platform-admin review, and responsive own-profile UI implemented. Additive migration 0020 and metadata validated on isolated PostgreSQL; not yet applied to DEV.
- P5-PRIVACY-02 / P2-PRIVACY-RACE-01: profile-only guard and anonymization pass synthetic isolated smoke; invitation approval serializes with account disable and requires active OWNER. Actual profile execution remains disabled by default. No live account was erased.
- Final DEV automated gates PASS: unit262/262 across49 files; domain15/15 with100% lines; API unit-only V8 40.08% (2374/5923), >=39 regression floor; PostgreSQL HTTP c8 87.41% (5691/6510) across all68 API files; mocked browser33/33; real PostgreSQL/browser workflows24/24 across Desktop,390px,320px; Manager owner-action visibility regression PASS; migration0020 rehearsal preserved/restored36 original table fingerprints.
- Lint and TypeScript PASS, Drizzle check PASS, high/critical audit gate PASS (six moderate advisories documented), disposable backup/restore/predeploy checks are current. Candidate public deployment and GitHub run are pending commit/push; deployed revision remains ce49565.
- External policy approval is required only before enabling real profile anonymization. See docs/P5_PRIVACY_PROFILE_WORKFLOW.md and docs/APARTMENT_IMPLEMENTATION_REPORT_2026-11-05.md. Remaining P0–P7 code/provider/UAT tasks remain open; this is not 100% DEV READY.

## 2026-11-05 deployed DEV checkpoint (ce49565)

- Integrated implementation dbf889a and CI build-environment fix ce49565 pushed. GitHub Actions run 41948158755 completed SUCCESS for both quality and PostgreSQL >=80% / backend browser jobs.
- Clean-archive images labelled ce495657c2b77b9d2cf9043c865a4e1450d58438 built and deployed through the existing Apartment Dokploy Compose configuration/project (Apartment API, Web and observe-only worker only). All healthy; PostgreSQL start timestamp unchanged, no shared proxy change.
- Applied migration 0018 and 0019; protected migration journal verification PASS. Fresh encrypted post-migration backup restored 36 public tables in a networkless disposable DB. Local backup timers remain enabled.
- Public HTTPS /, /healthz, /readyz 200; unsigned webhook 401. New deposit, meter records, privacy export and batch routes return 401 to unauthenticated public requests. Actual public guest browser checks at 1280/390/320 PASS with no navigation leak or horizontal overflow.
- Runtime stays LINE disabled / worker observe / approval false. Read-only LINE bot/info 200 with matching configured bot identity; zero external messages. Real LINE-account and bank UAT remain unverified.
- Latest local API tests 244/244; domain 15/15; domain lines 100%; actual HTTP/PostgreSQL API lines 87.03% over all 65 files, unit-only lines 40.49%; mocked browser 33/33, real-backend browser 12/12, public guest 3/3. Lint/types/audit High/Critical=0 pass (6 Moderate remain).
- Core increment DEPLOYED, NOT 100% overall. Continue remaining privacy/retention/contract, manual-refund reconciliation/reservation resolution, maintenance attachment/SLA, full financial browser and operator UAT work. No real erasure, refund, provider dispatch or Production release approval is inferred.


## 2026-11-05 release integration checkpoint — fresh automated evidence

- Current integrated source passes all finite DEV automated gates. API unit **244/244**, Domain **15/15**; Domain lines **100%**. Unit-only API V8 lines **40.49% (2325/5741)**, retaining the existing >=39% regression floor. The separate actual HTTP/PostgreSQL/native-V8 gate is **87.03% (5500/6319)** over **all 65 API source files**, zero omitted, enforced >=80%.
- Browser **33/33 mocked** and **12/12 real backend/PostgreSQL** PASS. The real owner scenario now creates org/property/room/lease, records deposit/review, writes meters, uploads/renders private sanitized photo and persists an anomaly review on desktop, 390px and 320px. Staff direct API denial, session expiry and logout remain covered.
- P1/P5 deposit ledger/review and P5 meter private proof/anomaly review are implemented and verified in DEV; see docs/P5_DEPOSIT_METER_QA.md. No actual refund transfer or bank verification occurs.
- P4 repair status producer passes transactional enqueue, repeat/concurrency deduplication, consent revocation and generic no-PII text tests. Invitation producer remains fail-closed: current explicitly accepted purpose does not include invitation/account messages.
- Fixed a reproduced Bulk Billing OWNER-revoke race. Active user/org/membership share locks now precede property approval locks; 3 concurrent approval replays during revocation are denied. RED and GREEN evidence is in apartment-qa-batch-revoke-red/green systemd journals.
- Migration 0018 + 0019 upgrade and backup recovery drill PASS on a disposable networkless PostgreSQL; all 32 original public-table fingerprints preserved, source schema restored afterward. Same-VPS encrypted backup/restore PASS; no live DB migration at this checkpoint.
- Real read-only LINE bot/info check HTTP **200**, configured bot identity matches. Zero messages sent; outbound disabled and worker observe/approval false. Root and runtime LIFF client configuration match; actual consented LINE account UAT remains unverified.
- TypeScript, lint zero warnings, Drizzle snapshot check and audit High/Critical=0 PASS; 6 Moderate remain. Runtime-secret value scan across candidate changed files PASS. QA jobs run sequentially with bounded memory/CPU; the VPS has 4 GB RAM.
- Source commit/push and existing Dokploy DEV application rollout are IN_PROGRESS. Build must use clean committed archive; deployment must back up/restore-verify first, update only Apartment API/Web/Observer, retain image rollback tags and never restore/drop the live DB automatically.
- Remaining code/policy work is still explicit: actual refund/reconciliation handling and reservation resolution, privacy erasure/retention and contract workflows, maintenance attachments/SLA acceptance, complete financial/tenant browser UAT, editable design acceptance, actual bank/scanner/storage/provider tests and production approval. **NOT 100% DEV READY; not external-dependencies-only.**


## 2026-11-05 latest verified QA increment (supersedes earlier numeric snapshots)

- API unit **214/214 PASS** (includes 14 exact satang parser regressions); Domain **15/15 PASS**, Domain lines **100%**.
- **API HTTP/PostgreSQL coverage 85.84% (5069/5905)** across **all 60 API source files**, zero omitted. A separate c8/native-V8 run instruments actual API child servers and the complete isolated DB smoke matrix, with an enforced **>=80%** line gate. Unit-only Vitest coverage remains **40.38%**; the metrics/engines are explicitly separate. See docs/verification/api-postgres-coverage-2026-11-05.json. This evidence comes from the current shared tree, not just pushed HEAD.
- Browser **12/12 real backend/PostgreSQL PASS** (4 cases × desktop/390px/320px): organization/property/room/lease creation, session expiry, real logout revocation, STAFF navigation plus direct server invoice denial and allowed room read. No API interception and no real LINE authentication in this suite. API servers restart between viewports to isolate rate-limit budgets; limits remain enabled. Runner config uses matching WEB_ORIGIN; CSRF remains enabled.
- Current frontend mock suite **33/33 PASS** after production Web build. Mock/provider and real-backend evidence remain distinct.
- Fixed integer satang input conversion (BigInt, precision/overflow guards); fixed owner membership refresh immediately after organization creation. Owner role refresh is verified by real browser assertions.
- Lint **0 warnings**, TypeScript PASS, audit **0 High/Critical**, **6 Moderate** remain.
- Backup and restore services Result=success; encrypted archive, retention/corruption/disk/locking tests rerun PASS; existing HTTPS DEV /, /healthz, /readyz 200 and unsigned webhook 401 PASS. Four Apartment timers active, no failed systemd units observed.
- Pushed isolated verified commits **ec08eb4** (encrypted local backups) and **b234065** (exact satang parser). Other existing/shared feature code, expanded QA and CI changes remain uncommitted; do not stage unrelated changes or pretend GitHub has executed this new coverage job.
- DEV runtime LINE credentials are present (not provider-verified); outbound **disabled**, worker **observe**, approval **false**. S3 credentials/endpoint missing; local evidence storage and malware scanning disabled. Real scanner/provider/bank acceptance is unverified.
- All phases P0–P7 remain IN_PROGRESS overall. Pending implementation includes persisted deposit/refund review API/UI, meter photo/anomaly review, remaining notification event producers, privacy deletion/retention and complete critical browser/UAT coverage. This is NOT a claim that only external gates remain.

Full report: docs/APARTMENT_IMPLEMENTATION_REPORT_2026-11-05.md. Next implementation priority: deposit ledger/review with isolated migration, owner authorization/concurrency tests and UI; preserve shared migration 0017 and all existing work.


## 2026-11-05 approved same-VPS backup implementation — current evidence

User explicitly replaced the independent-offsite requirement for DEV with encrypted backups on this VPS. Historical offsite blockers below are superseded for DEV local-backup acceptance only. Same-disk host-loss risk remains; no offsite compliance is claimed.

| Task | Phase | Status | Evidence / files | Dependency / deployment |
|---|---|---|---|---|
| P0-LOCAL-BACKUP | P0/P7 | DONE | infra/local-archive-apartment-postgres.sh; source backup script configurable retention; authenticated age encryption + SHA-256, 0700/0600, flock, retention preserves newest verified backup | /etc/apartment config and identity installed; no secrets committed |
| P0-LOCAL-RESTORE | P0/P7 | DONE | Encrypted-only restore into networkless PostgreSQL 16; 32 tables; no plaintext source dependency | weekly restore timer enabled, Sunday 05:00 Bangkok |
| P0-LOCAL-MONITOR | P0/P7 | DONE | hourly freshness from dump timestamp, disk threshold, checksum; failure/disk/corruption/lock tests PASS; local syslog OnFailure alert exercised | hourly timer enabled; external paging not configured/claimed |
| P7-MIGRATION-DRILL | P7 | DONE | repaired current-schema collision by selecting newest checksum-valid pre-0017 archive; real 0017 upgrade + five content fingerprints + isolated backup recovery PASS | no live database mutation |
| P7-COVERAGE | P7 | IN_PROGRESS | fresh unit API 200/200 PASS; V8 API line 40.38% (2161/5351); target >=80%; isolated full HTTP smoke coverage runner being verified | no threshold relaxation |
| P7-BROWSER | P6/P7 | IN_PROGRESS | fresh Playwright 27/27 PASS desktop/390px/320px; intercepted API only | actual backend-connected workflows and LINE provider/UAT remain open |
| P7-DEV-SMOKE | P7 | DONE (observed existing deployment) | HTTPS /, /healthz, /readyz each 200; unsigned webhook 401; Apartment API/Web/Observer/Postgres healthy | no application image deployment in this pass |

Fresh lint 0 warnings and typecheck PASS. Dependency audit: 0 high/critical, 6 moderate. Backup service ExecStartPost archive ran successfully (Result=success, ExecMainStatus=0). Evidence: /tmp/apartment-current-tests.log, /tmp/apartment-current-coverage.log, /tmp/apartment-current-e2e.log, /tmp/apartment-current-lint.log, /tmp/apartment-current-types.log, /tmp/apartment-current-audit.log and systemd journal. Runtime logs are transient; reproduce using docs/LOCAL_BACKUP.md commands.

All seven approved local backup gates passed: LOCAL_BACKUP_PASS (BACKUP_OK), BACKUP_CHECKSUM_PASS, BACKUP_ENCRYPTION_PASS, BACKUP_RESTORE_DRILL_PASS, MIGRATION_ROLLBACK_DRILL_PASS (RECOVERY_DRILL_PASS), BACKUP_RETENTION_PASS, BACKUP_MONITORING_PASS. Original command output names are shown in parentheses; these are not additional fabricated command outputs.

Recovery-key operator export/custody not yet confirmed. Real LINE dispatch is still disabled, S3/clamd/bank/provider/legal/UAT evidence remains separate. Do not declare P0–P7 complete or 100% DEV READY. Existing mixed working-tree changes are preserved.


> Evidence-aware snapshot created from `docs/PHASES.md`, `docs/CODING_PHASE_BACKLOG.md` and fresh read-only checks. It does not override the canonical plan or release approvals. No secrets are recorded.

## 2026-11-05 implementation continuation (verified)

- Added root `@playwright/test` 1.64.1, `playwright.config.ts`, and `tests/e2e/portal.spec.ts`; **27/27 PASS** over Desktop and 390px / 320px Mobile Chromium, using intercepted mock API only. See `docs/P7_BROWSER_E2E_RUNBOOK.md`. The Snap Chromium issue is bypassed by real Playwright Chromium; real LINE-provider browser E2E remains open.
- Found/mitigated Logout sidebar viewport overflow: sticky sidebar now scrolls internally and mobile menu can reach logout. Desktop and both mobile logout E2E PASS.
- `pnpm lint` enforces `--max-warnings=0`; lint and TypeScript PASS. `pnpm audit --audit-level high` PASS; **6 Moderate dev dependency advisories** remain and require triage.
- Ran **all listed CI HTTP/Postgres regression suites** against isolated throwaway PostgreSQL 16, never the DEV DB: organization isolation, staff scope, independent security, HTTP/PromptPay/PDF, concurrent payments, finance, maintenance, billing batches, LINE signed webhook, tenant consent, S3 mock, evidence cleanup — all PASS after updating two stale test fixtures.
- Billing Batch test fixture corrected for changed meter reading after preview, asserting actual immutable invoice totals (1,200 + 1,300 satang) and 5 parallel idempotent approval replays; isolated migration 0017 and concurrent smoke PASS.
- LINE smoke fixture previously supplied an invalid non-hex channel secret; switched to random 16-byte hex secret. All provider calls in this test remain synthetic/disabled. LINE smoke and consent suites PASS with matching synthetic OA identity.
- CI quality job now runs Playwright Desktop/Mobile E2E; CI PostgreSQL job now runs Bulk Billing HTTP smoke. Remote GitHub Actions status for these new uncommitted changes **not yet proven**.
- Real `age` + `rclone` authenticated encryption and decryption roundtrip using a local temporary rclone alias **PASS**, verifying the backup SHA-256 without network transmission or writing to the live DB. This is **not an independent offsite DR drill**; external destination, key custody, retention, RPO/RTO signoff remain BLOCKED.
- No production release, provider sends or real payments authorized. The existing Git working tree and other agents' uncommitted code remain preserved; no push or Dokploy redeploy of these new WIP changes.

## Live verification (2026-11-04, Asia/Bangkok)
- Branch `main`, HEAD `07c5c34`; pre-existing uncommitted work was preserved. No commit, push, or deployment performed in this audit.
- `corepack pnpm test`: **200/200 PASS** (44 API test files, with Domain suite executed before API).
- `corepack pnpm typecheck`: **PASS** after five targeted lint cleanups.
- `corepack pnpm lint`: **PASS**, zero errors and zero warnings after five targeted lint cleanups.
- `corepack pnpm coverage:api`: **40.38% line coverage (2,161/5,351)**, below mandatory **80%**.
- `corepack pnpm --filter @apartment/web build`: **PASS**, chunk-size warning remains.
- Read-only DB schema compatibility preflight: **PASS**, 335 Drizzle columns, zero mutations.
- Existing DEV PostgreSQL read-only count: **18 applied migrations**, **32 public tables**.
- Docker: Apartment API/Web/LINE Observer/PostgreSQL all **healthy** at inspection.
- HTTPS `/`, `/healthz`, `/readyz`: each **HTTP 200** at inspection. These are smoke checks, not browser E2E.
- Isolated networkless PostgreSQL backup recovery drill: **PASS**; SHA-256 verified, migration 0017 upgraded seeded copy, five content fingerprints preserved, original backup restored, disposable container removed. **No live DB mutations**.
- Installed OS CLI prerequisites `age` 1.1.1 and `rclone` 1.60.1 without restarting services. Offline upload mock: **PASS**, immutable/fail-closed behavior checked.
- `/etc/apartment/offsite.env` is missing, offsite timer inactive and no approved remote configured; real encrypted offsite recovery remains **BLOCKED**.
- Local Snap Chromium failed (`snap-update-ns: Operation not permitted`), no Playwright dependency installed; Browser E2E remains **BLOCKED**.
- Real sandbox LINE sends, bank verification and independent offsite recovery **not run/verified** during this audit.

## Overall acceptance by phase

| Phase | Status | Evidence / blocker |
|---|---|---|
| P0 | [~] IN PROGRESS | DEV infrastructure is healthy; actual independent encrypted offsite upload/restore, RPO/RTO approval and 80% coverage remain open. |
| P1 | [~] IN PROGRESS | Billing/owner workflows partly developed; deposit ledger/refund workflow, long soak and owner acceptance remain open. |
| P2 | [~] IN PROGRESS | Mocked login/invite tests exist; real LIFF/LINE test user, mobile browser callback and owner/tenant E2E remain open. |
| P3 | [~] IN PROGRESS | Manual-ledger/payment evidence exists; bank-recipient validation, real S3/ClamAV, refund/tax/legal approval are open. |
| P4 | [~] IN PROGRESS | Signed webhook/consent/outbox exist; organization OA binding and approved end-to-end sandbox sends are open. Keep live outbound disabled. |
| P5 | [~] IN PROGRESS | Partial bulk billing/maintenance/reports/privacy functions; full integration, financial flows and browser UAT remain open. |
| P6 | [~] IN PROGRESS | Responsive React owner/tenant work partially implemented; Figma editable screens, accessibility/device acceptance and super-admin UX open. |
| P7 | [~] IN PROGRESS | Unit/TS/lint/web build and public health PASS; 80% meaningful API coverage, browser/provider E2E, security, DR, UAT and legal signoff open. |

## Task ID register

Task IDs are derived from the canonical plan. **`[x] DONE` denotes a DEV checklist item that the canonical document identifies as implemented/verified; it does not denote production acceptance or a fresh per-task E2E rerun.** `[~] IN PROGRESS` means the canonical checklist remains unchecked. `[ ] TODO` means the identifier appears in prose but has no direct checkbox; it requires reconciliation.

| Task ID | Status | Canonical scope / evidence |
|---|---|---|
| P1-01 | [~] IN PROGRESS | Room move-out, maintenance and lease lifecycle transitions (PARTIAL) — `docs/PHASES.md` |
| P1-01a | [x] DONE (DEV checklist) | Strict owner-only move-out with final meter/invoice settlement guards, no pending claims/finance, room released AVA — `docs/PHASES.md` |
| P1-01b | [~] IN PROGRESS | Repair/maintenance ticket workflow and room return-from-maintenance, deposit settlement, former-tenant records acce — `docs/PHASES.md` |
| P1-02 | [x] DONE (DEV checklist) | Property Master effective-dated rate history, owner authorization, audit and immutable invoice rate snapshots (DEV) — `docs/PHASES.md` |
| P1-03 | [~] IN PROGRESS | Active-rate validity for partial leases, mid-cycle adjustments, meter replacement (PARTIAL — DEV) — `docs/PHASES.md` |
| P1-03a | [x] DONE (DEV checklist) | Effective-dated room override versions (migration 0013), owner-only full-period schedule, room/current read models, — `docs/PHASES.md` |
| P1-03b | [x] DONE (DEV checklist) | Explicit MOVE_IN partial billing from actual lease start to canonical period end, prorated rent with real boundary  — `docs/PHASES.md` |
| P1-03c | [ ] TODO (reconcile ID) | Mentioned in plan or handoff; no individually checked acceptance row — `docs/PHASES.md` / `docs/NEXT_SESSION.md` |
| P1-03c.1 | [x] DONE (DEV checklist) | Meter replacement records (0014), old closing/new opening, serial continuity, owner-only audit, segment-aware readi — `docs/PHASES.md` |
| P1-03c.2 | [x] DONE (DEV checklist) | Strict final MOVE_OUT partial invoice; actual boundary meters/usage, prorated rent, no overlap, then separate settl — `docs/PHASES.md` |
| P1-03c.3 | [~] IN PROGRESS | Legal meter evidence verification, tenant notices, deposit/refund/credit settlement and Production financial-securi — `docs/PHASES.md` |
| P1-04 | [x] DONE (DEV checklist) | DEV property-level STAFF grants (VIEWER/METER_READER), OWNER-only invite/claim/approve/revoke, manager-denied membe — `docs/PHASES.md` |
| P1-05 | [~] IN PROGRESS | Negative-amount/overflow/duplicate/concurrency verification gates under load (**IN PROGRESS**) — `docs/PHASES.md` |
| P2-01 | [x] DONE (DEV checklist) | Owner generates single-use lease invite: random unguessable token, SHA-256 hash in DB, expiry, revoke superseded to — `docs/PHASES.md` |
| P2-02 | [x] DONE (DEV checklist) | Authenticated tenant claims invite atomically into pending state (NO bill access); owner manually approves verified — `docs/PHASES.md` |
| P2-03 | [x] DONE (DEV checklist) | Tenant only sees own leases, property/room summaries, issued bills and immutable line items; no IDOR / organization — `docs/PHASES.md` |
| P2-04 | [x] DONE (DEV checklist) | Mobile LIFF-capable tenant view + owner invite/approve UI (build verified, real LINE/browser E2E pending); clean em — `docs/PHASES.md` |
| P2-05 | [x] DONE (DEV checklist) | Tests for expired/replaced/replayed invites, one-winner concurrent claims, owner approval, unrelated tenant IDOR, d — `docs/PHASES.md` |
| P2-06 | [~] IN PROGRESS | LINE sandbox E2E with real channel and linked test user (**BLOCKED:** LINE Channel ID + LIFF ID + HTTPS origin). Br — `docs/PHASES.md` |
| P3-01 | [~] IN PROGRESS | Payment instructions per property: owner-configured bank/PromptPay and **PromptPay QR builder, invoice-scoped API a — `docs/PHASES.md` |
| P3-01a | [x] DONE (DEV checklist) | Owner/Super Admin-only bank settings with optimistic CAS, audit, property scope, disabled state and tenant invoice- — `docs/PHASES.md` |
| P3-01b | [~] IN PROGRESS | PromptPay QR core implemented, real bank-app interoperability/recipient-registration check PENDING — `docs/PHASES.md` |
| P3-01b.1 | [x] DONE (DEV checklist) | BOT merchant-presented EMV Tag 29/54/63 builder, 10-digit mobile or 13-digit tax/national ID input, integer-satang  — `docs/PHASES.md` |
| P3-01b.2 | [x] DONE (DEV checklist) | Owner and authorized tenant invoice-scoped no-store APIs, direct browser QR rendering, masked ID, copy/save/refresh — `docs/PHASES.md` |
| P3-01b.3 | [~] IN PROGRESS | **BLOCKED on hands-on confirmation:** scan with real bank apps and confirm actual registered recipient name, fixed  — `docs/PHASES.md` |
| P3-02 | [~] IN PROGRESS | Tenant submits evidence securely; **DEV local private evidence implemented**, S3/presigned upload pending — `docs/PHASES.md` |
| P3-02a | [x] DONE (DEV checklist) | Authenticated multipart evidence upload with <4 MB, JPEG/PNG/WebP decoder, 12MP limit, EXIF-stripped WebP re-encode — `docs/PHASES.md` |
| P3-02b | [~] IN PROGRESS | Signed private S3-compatible evidence storage (PARTIAL; live provider/security gate pending) — `docs/PHASES.md` |
| P3-02b.1 | [x] DONE (DEV checklist) | AWS SDK v3 S3 adapter, ENV validation, signed 5-minute quarantine PUT (bound size, SHA-256 checksum), HEAD, bounded — `docs/PHASES.md` |
| P3-02b.2 | [x] DONE (DEV checklist) | Backend decode, ≤12MP sanitation, metadata-stripped WebP, separate private key, original quarantine cleanup — `docs/PHASES.md` |
| P3-02b.3 | [x] DONE (DEV checklist) | Tenant LIFF chooses S3 direct workflow when enabled; single-use READY→CLAIMED ticket bound to verified tenant/invoi — `docs/PHASES.md` |
| P3-02b.4 | [x] DONE (DEV checklist) | Real PostgreSQL + local HTTP S3 **mock** test (SigV4 URL shape, checksum mismatch, replay, tenant IDOR, one-time cl — `docs/PHASES.md` |
| P3-02b.5 | [~] IN PROGRESS | **BLOCKED:** live provider IAM/signature/CORS validation with real credentials + HTTPS endpoint, object policy and  — `docs/PHASES.md` |
| P3-02b.6 | [~] IN PROGRESS | Safe evidence expiry/cleanup and malware scanning (PARTIAL — Production acceptance pending) — `docs/PHASES.md` |
| P3-02b.6a | [x] DONE (DEV checklist) | Migration 0007: legal_hold, EXPIRED, expired_at, cleaned_at; dry-run default, explicit org/confirmation apply; expi — `docs/PHASES.md` |
| P3-02b.6b | [x] DONE (DEV checklist) | Isolated PostgreSQL smoke: dry-run, expired ticket, retained legal hold/CLAIMED/referenced evidence and failed-dele — `docs/PHASES.md` |
| P3-02b.6c | [x] DONE (DEV checklist) | ClamAV TCP INSTREAM adapter: optional DEV, source+sanitized image scans, mock daemon clean/infected/error/timeout/c — `docs/PHASES.md` |
| P3-02b.6d | [~] IN PROGRESS | Live clamd EICAR/signature update, S3 lifecycle and restore proof, admin legal retention workflow, worker schedulin — `docs/PHASES.md` |
| P3-02c | [x] DONE (DEV checklist) | Production startup fails until production evidence/security hardening is implemented — `docs/PHASES.md` |
| P3-03 | [x] DONE (DEV checklist) | Owner-only manual review/approve/reject with transaction, transfer-reference unique per property, idempotency key,  — `docs/PHASES.md` |
| P3-03b | [~] IN PROGRESS | Overpayment credit / refund / dispute policy and workflow; automatic bank verification not implemented — `docs/PHASES.md` |
| P3-04 | [~] IN PROGRESS | Ledger and receivables reporting (**partial**) — `docs/PHASES.md` |
| P3-04a | [x] DONE (DEV checklist) | Append-only payment Ledger created transactionally with approval, immutable invoice still ISSUED, outstanding and m — `docs/PHASES.md` |
| P3-04b | [~] IN PROGRESS | Financial corrections / refunds / disputes (PARTIAL, legal/bank gates pending) — `docs/PHASES.md` |
| P3-04b.1 | [x] DONE (DEV checklist) | Internal credit and manual payment record reversal: append-only entries, original payment Ledger immutable, invoice — `docs/PHASES.md` |
| P3-04b.2 | [x] DONE (DEV checklist) | Two-owner workflow: distinct active OWNER request/review; MANAGER rejected; status/idempotency/audit, client reques — `docs/PHASES.md` |
| P3-04b.3 | [x] DONE (DEV checklist) | Review-only refund/dispute requests, no cash payouts, no bank-verified settlement; balance reporting separates net  — `docs/PHASES.md` |
| P3-04b.4 | [~] IN PROGRESS | Actual refund/chargeback, statutory credit note/tax compliance, reconciliation, dispute evidence & audit sign-off — `docs/PHASES.md` |
| P3-05 | [~] IN PROGRESS | Invoice/receipt PDFs and document compliance (PARTIAL: specification only) — `docs/PHASES.md` |
| P3-05a | [x] DONE (DEV checklist) | Document type / snapshot / numbering / issuer / access-control / Thai glyph acceptance criteria in `docs/P3_PDF_REC — `docs/PHASES.md` |
| P3-05b | [x] DONE (DEV checklist) | Non-tax Billing Notice PDF from immutable amount/lines + issuance-time issuer/property/tenant/room snapshot; Thai f — `docs/PHASES.md` |
| P3-05c | [~] IN PROGRESS | Official receipts, tax invoices and VAT/issuer/retention/legal approval — `docs/PHASES.md` |
| P3-06 | [x] DONE (DEV checklist) | DEV tenant-IDOR/manager-denial, replay/version-CAS, private evidence, payment status, partial/full/overpay and conc — `docs/PHASES.md` |
| P3-06b | [~] IN PROGRESS | Real bank reconciliation E2E, S3 signed-upload E2E, browser/LIFF and production performance/load gates — `docs/PHASES.md` |
| P4-01 | [x] DONE (DEV checklist) | Provisional one LINE OA per organization (multiple properties), unique org/destination binding, admin-only controll — `docs/PHASES.md` |
| P4-02 | [x] DONE (DEV checklist) | Signed raw-body webhook (HMAC-SHA256 constant-time), 256KiB limit, rate limit, 100-event bound, destination check,  — `docs/PHASES.md` |
| P4-03 | [~] IN PROGRESS | Durable outbox, worker and LINE delivery (PARTIAL; live worker/scheduler pending) — `docs/PHASES.md` |
| P4-03a | [x] DONE (DEV checklist) | Consent-bound transactional enqueue, stable idempotency/retry key, PostgreSQL SKIP LOCKED worker claim, exponential — `docs/PHASES.md` |
| P4-03b | [x] DONE (DEV checklist) | Real PostgreSQL mock HTTP/outbox tests: valid signature, duplicate delivery, consent revoked, simulated no-send, 42 — `docs/PHASES.md` |
| P4-03c | [~] IN PROGRESS | Monitoring/worker operations (PARTIAL — provider/live gate pending) — `docs/PHASES.md` |
| P4-03c.1 | [x] DONE (DEV checklist) | Scoped, sanitized Super Admin counters + Dead-letter list, one-time review and audit, migration 0010 — `docs/PHASES.md` |
| P4-03c.2 | [x] DONE (DEV checklist) | Separate continuous observe-only DEV worker with heartbeat health, 60-second poll, no public port, fail-closed live — `docs/PHASES.md` |
| P4-03c.3 | [x] DONE (DEV checklist) | TDD unit and real PostgreSQL HTTP tests for role/scope/PII/duplicate review/immutable terminal status — `docs/PHASES.md` |
| P4-03d | [ ] TODO (reconcile ID) | Mentioned in plan or handoff; no individually checked acceptance row — `docs/PHASES.md` / `docs/NEXT_SESSION.md` |
| P4-03d.1 | [x] DONE (DEV checklist) | Durable per-org/global rolling 60-second attempt reservations with cross-worker PostgreSQL advisory transaction loc — `docs/PHASES.md` |
| P4-03d.2 | [x] DONE (DEV checklist) | Durable internal incident episodes (Dead-letter unreviewed / expired Sending / queue backlog), duplicate-suppressio — `docs/PHASES.md` |
| P4-03d.3 | [x] DONE (DEV checklist) | Pure TDD fairness/threshold tests + real PostgreSQL concurrent mock-sender quota and admin incident lifecycle HTTP  — `docs/PHASES.md` |
| P4-03d.4 | [~] IN PROGRESS | Real provider quota calibration, multi-channel fairness, external incident paging, production live sender acceptanc — `docs/PHASES.md` |
| P4-03e | [ ] TODO (reconcile ID) | Mentioned in plan or handoff; no individually checked acceptance row — `docs/PHASES.md` / `docs/NEXT_SESSION.md` |
| P4-03e.1 | [x] DONE (DEV checklist) | Consent revoke/dispatch race serialization with consistent lease/OA/consent lock order, real mock HTTP concurrency  — `docs/PHASES.md` |
| P4-03e.2 | [x] DONE (DEV checklist) | Per-org 30-day min reservation retention, manual dry-run by default and bounded confirmed cleanup with PostgreSQL i — `docs/PHASES.md` |
| P4-03e.3 | [~] IN PROGRESS | Alert delivery/retention legal policy, real LINE provider quota, live in-flight uncertainty testing and offsite bac — `docs/PHASES.md` |
| P4-04 | [~] IN PROGRESS | Tenant consent and notification event producers (PARTIAL — real provider and future workflows pending) — `docs/PHASES.md` |
| P4-04a | [x] DONE (DEV checklist) | Tenant-specific opt-in/revoke endpoints and React UI with explicit purpose acknowledgment, active verified LINE lea — `docs/PHASES.md` |
| P4-04b | [x] DONE (DEV checklist) | Invoice-issued Outbox event created atomically with invoice transaction only on active lease + enabled OA + unrevok — `docs/PHASES.md` |
| P4-04c | [x] DONE (DEV checklist) | Manual due-date Outbox preparation with Bangkok-day guard, org-scoped dry-run default, explicit confirmation for en — `docs/PHASES.md` |
| P4-04d | [~] IN PROGRESS | Real LINE Messaging API/LIFF validation and consent policy, invitation and repair event producers (not yet eligible — `docs/PHASES.md` |
| P4-05 | [~] IN PROGRESS | LIFF callback/login/logout/tenant invitation with actual LINE sandbox E2E — `docs/PHASES.md` |
| P5-01 | [~] IN PROGRESS | Monthly and 15-day scheduled bulk invoices (preview → approval → batch process) — `docs/PHASES.md` |
| P5-02 | [~] IN PROGRESS | Maintenance tickets and room status workflow; files, notifications, SLA (IN PROGRESS — partial DEV) — `docs/PHASES.md` |
| P5-03 | [~] IN PROGRESS | Utility meter photo proof; reading anomalies / reset / replacement — `docs/PHASES.md` |
| P5-04 | [~] IN PROGRESS | Security deposits, move-out settlement, rent/utility disputes, void/credit notes — `docs/PHASES.md` |
| P5-05 | [~] IN PROGRESS | Occupancy and revenue dashboard; exports/reporting with access control — `docs/PHASES.md` |
| P5-06 | [~] IN PROGRESS | Contract, tenant profile, privacy retention / data export / deletion workflows — `docs/PHASES.md` |
| P6-01 | [~] IN PROGRESS | Color / typography / spacing tokens and component states documented in Figma — `docs/PHASES.md` |
| P6-02 | [~] IN PROGRESS | Mobile owner: dashboard, rooms, meter, billing, tenant list, payment confirmation — `docs/PHASES.md` |
| P6-03 | [~] IN PROGRESS | Mobile tenant: onboarding, bill details, payment evidence, repairs, history — `docs/PHASES.md` |
| P6-04 | [~] IN PROGRESS | Desktop Super Admin: owner/tenant overview, compliance, audit and support — `docs/PHASES.md` |
| P6-05 | [~] IN PROGRESS | WCAG focus, error/empty/loading states, responsive QA at 320px/390px/desktop — `docs/PHASES.md` |
| P7-01 | [~] IN PROGRESS | Independent security review: CSRF, tenant IDOR, SSRF, auth/session rotation, role revoke — `docs/PHASES.md` |
| P7-02 | [x] DONE (DEV checklist) | lint cleanup (2026-11-04): reduced ESLint warnings 37 → 5 (0 errors), leaving 5 in concurrent Bulk Billing working  — `docs/PHASES.md` |
| P7-03 | [~] IN PROGRESS | Multi-tenant isolation tests incl. missing, disabled, suspended membership/lease/property (PARTIAL) — `docs/PHASES.md` |
| P7-04 | [~] IN PROGRESS | Privacy, legal and utility tariff signoff; Thai tenancy, tax/receipt compliance — `docs/PHASES.md` |
| P7-05 | [~] IN PROGRESS | Backup/restore proof, migrations with rollback plan, monitoring / alerting — `docs/PHASES.md` |
| P7-06 | [~] IN PROGRESS | Secure HTTPS domain, LINE developer callback and Dokploy DEV deployment; smoke — `docs/PHASES.md` |
| P7-07 | [~] IN PROGRESS | Performance/load/billing concurrency, owner/tenant UAT; only then prod launch — `docs/PHASES.md` |

## Open hard gates (must not be inferred from passing unit tests)
- **P0/P7:** Increase meaningful API lines from 40.38% to at least 80%, with realistic HTTP/DB/integration tests; keep CI threshold enforced and independently confirm PR rules.
- **P0/P7:** Real, encrypted offsite upload and recovery drill on separate host, approved RPO/RTO, alerting and backup operational owner.
- **P1/P3/P5:** Persisted deposit/refund review workflow and full invoice-payment-finance concurrency/reconciliation; legal/tariff/receipt approval.
- **P2/P4:** Real LINE channel and verified administrator, real owner+tenant sandbox accounts, OA binding, signed provider round-trip, consent-revocation safety and bounded sends.
- **P3:** Test S3 policies, IAM/SigV4/CORS, malware scanner and real bank app merchant/recipient identity in separately authorized environments.
- **P6/P7:** Real desktop/mobile browser E2E, WCAG/accessibility, load SLO, external security test and owner/tenant UAT.
- **Release:** Do not enable live outbound or financial settlement, and do not claim production-ready until all external signoffs are explicit.

## Immediate safe next actions
1. Keep existing uncommitted feature files intact; agree code ownership/worktree boundaries before merging or deploying those changes.
2. Extend HTTP/DB authorization and financial workflow integration tests, then rerun coverage and all checks; prioritize high-risk untested API logic.
3. Run isolated migration rehearsals and real offsite restore once backup credentials and separate destination are configured; no live DB destructive operations.
4. Add mocked-LINE browser E2E and operator-approved provider sandbox E2E; do not auto-enable live LINE messages.
5. Reconcile statuses with `docs/PHASES.md` after each accepted implementation and attach command/test/deployment evidence.

## DEV deployment boundary
- The currently deployed DEV services were **observed healthy**; this session did not deploy its uncommitted changes.
- Keep `LINE_OUTBOUND_MODE=disabled` and observer-only sender until explicit sandbox tests, consent gates and operator authorization pass.
- Never alter other VPS services, reset PostgreSQL volumes, or expose secrets in logs/documentation.

## 2026-11-05 session-expiry browser regression

- P7 IN_PROGRESS: added `tests/e2e/session-expiry.spec.ts`; simulated a server-side /v1/me 401 after owner reload. Desktop, 390px and 320px passed (3/3), full mocked browser suite 30/30. API unit 200/200, lint and typecheck passed; API line coverage 40.38% (2161/5351), so 80% gate remains open. Public DEV smoke passed for web, health, readiness and unsigned webhook denial. No commit/push/deploy for this uncommitted shared tree.

- P6/P7 IN_PROGRESS (2026-11-05): `tests/e2e/property-room.spec.ts` verifies owner creation of a property, room, lease and meter reading through the responsive UI; it checks integer-satang rent, tenant lease linkage and water reading payloads. Desktop, 390px, 320px pass (3/3); complete mocked browser suite 33/33 and ESLint pass. This is a mock API browser contract, not PostgreSQL or real LINE provider UAT.

- P7 coverage gate (2026-11-05): `bash infra/test-api-postgres-coverage.sh` completed against disposable PostgreSQL and `coverage/postgres/coverage-summary.json` reports API lines 85.84% (5,069/5,905), zero skipped. This is HTTP/integration coverage including spawned API servers; unit-only `coverage:api` remains 40.38% (2,161/5,351). Keep both measurements distinct.

- P7 independent verification (2026-11-05): domain coverage 100% lines (69/69), 15/15 tests; `pnpm audit --audit-level high` exit 0 with six moderate advisories and zero reported high/critical. Same-VPS archive integration passed checksum, encryption, retention, corruption/disk/lock cases; isolated migration rollback and public HTTPS smoke passed. This does not close provider and business acceptance gates.


## Verified checkpoint — 2026-11-05

Candidate `4bdc99157f9a93d8e019378de4355f5aecb8817f` is committed on `main` and deployed to Dokploy DEV. Public health/readiness and web return200, unsigned webhook plus unauthenticated privacy endpoints return401. API/Web/observer healthy; PostgreSQL not restarted; privacy migration0020 deployed. Pre-deploy encrypted local backup and isolated restore drill PASS. Full local gates PASS: unit262/262, domain15/15 (100%), API unit-only40.08%, PostgreSQL HTTP c8 87.41% across68 files, mock browser33/33, real backend browser24/24, migration rollback, lint/typecheck and no critical/high dependency findings. Remaining code/UAT work and external provider verification remain open; this is not 100% complete or production approved.


## Continuation checkpoint — 2026-11-05

Code delta in progress: property-scoped summary-only maintenance SLA endpoint added. Authorization reuses `requireProperty`; response is private/no-store and exposes counts only. Unit test, PostgreSQL smoke, lint and typecheck pass; full run: API263 tests, PostgreSQL c8 87.45%, mock browser33/33, real-backend browser24/24. Commit `ab37dac` pushed and deployed; post-deploy health, migration/observer safety and unauthenticated SLA route checks pass. Remaining maintenance attachments/configurable SLA policy and other phase backlog tasks are still open; no 100% claim.


## Maintenance attachment code checkpoint — 2026-11-05

Implementation verified: sanitized private image upload/list/download on maintenance tickets, malware scan + re-encode/metadata stripping, 2MB per file, max5 per ticket, PostgreSQL storage and audit. Tenant access is bound to the reporting user; property access uses property/ticket authorization. E2E file upload/download passed at desktop/390/320; PostgreSQL smoke, schema migration/rollback, typecheck/lint passed. Commit/deploy pending. Configurable SLA policy and legally approved retention remain open; this does not complete P5.

## Verified continuation — 2026-11-05 (latest)

- **P5 maintenance attachment code:** `003c335` adds private sanitized image upload/list/download with malware scan, metadata removal, DB-backed storage, owner/tenant ticket scoping, audit and responsive browser coverage. Local validation passed: API 263/263, domain 15/15, mock Playwright 33/33, backend Playwright 24/24, API PostgreSQL coverage 87.6%, typecheck/lint, isolated migration rollback.
- **Commit / push:** `003c335f330d63cdf851cf2f70f22c2f113efbb1` on `main`, pushed to `origin/main`.
- **DEV deployment:** deployed to Dokploy DEV. Pre-deploy same-VPS encrypted backup, SHA-256, retention/monitoring and isolated restore of 37 public tables passed. Migration/observer safety passed; Web/API/readiness HTTPS 200; unsigned webhook 401; no live LINE calls; PostgreSQL was not restarted. Runtime commit `003c335f330d63cdf851cf2f70f22c2f113efbb1`.
- **Scope:** this closes attachment implementation and deployment. It does not close P5 overall: configurable SLA policy, retention/legal policy, consent-bound workflow acceptance and remaining phase backlog stay open. Same-VPS backup does not protect against VPS host loss. No UAT or production approval is claimed.

## 2026-11-05 follow-up — commit/deploy and LINE OA readiness

- **Code/test commit:** `57706b1` pushed to `main`; the only source diff is a more specific Playwright locator for the maintenance status badge. PostgreSQL-backed browser workflows passed 24/24 across desktop, 390px and 320px.
- **Deployment attempt:** built API/Web images for `57706b1`; deployment script created and verified same-VPS encrypted backup/checksum/retention, then public HTTPS smoke could not connect to `apartme.makemarket.space:443`. The script automatically rolled back application images only; it did not restore or restart PostgreSQL. Runtime API/Web/observer are healthy on app revision `003c335`.
- **Proxy diagnosis:** DNS resolves, but host has no active Nginx service, proxy container or local 80/443 listener. Do not restart shared proxy blindly: ACME persistence is documented as read-only. HTTPS/public smoke is BLOCKED until the existing approved proxy routing is restored safely.
- **LINE OA:** runtime channel secret/access token/bot ID are present (values never logged); read-only LINE Bot Info returned HTTP 200 and configured bot ID matches; LINE webhook endpoint API returned HTTP 200 and already points to `https://apartme.makemarket.space/v1/line/oa/webhook`. Runtime remains `LINE_OUTBOUND_MODE=disabled`, worker `observe`, approval `false`. DEV DB currently has 0 active organizations and 0 OA bindings, so no organization can be bound via the authenticated admin API yet. No outbound messages were sent.
- **ENV boundary:** DEV runtime has secure cookie/origin, local evidence storage, malware scanner explicitly disabled (`NOT SCANNED`), privacy anonymization not approved, and LINE outbound safe mode. Do not enable live sends or invent retention/legal values.
