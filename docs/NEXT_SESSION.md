# Apartment — START HERE (new coding session)

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


## Latest verified implementation continuation — 2026-11-05

**P7 Browser:** `corepack pnpm test:e2e` 27/27 PASS across Chromium Desktop and 390px/320px mobile; mocked frontend APIs only. `docs/P7_BROWSER_E2E_RUNBOOK.md` lists the test matrix and provider/UAT limitations. Fixed unreachable Sidebar Logout via internal vertical overflow. `@playwright/test` is pinned in root dev dependencies, lockfile updated; GitHub Actions quality job now installs Chromium and runs browser suite.

**P5/Postgres Security:** Fresh throwaway PostgreSQL 16 migration and all applicable CI HTTP smoke scripts PASS (organization/staff/security, payments/finance, maintenance, Bulk Billing, LINE signed webhook/consent, mock S3/evidence cleanup). Billing Batch regression corrected for meter change (1,200 + 1,300 satang), asserts concurrent approval replay creates no duplicates; CI PostgreSQL job runs its smoke. LINE webhook smoke fixture now creates valid random hex secret. No live DB mutations.

**P0 Offsite:** Real age/rclone encrypted upload/readback/decrypt SHA-256 roundtrip PASS using temporary **local** alias and ephemeral age key; local mock failure-path tests previously PASS. Real independent offsite restore, provider config, recovery key custody, RPO/RTO remain blocked; do not enable offsite timer yet.

**P7 Outstanding:** API line coverage 40.38% (target 80%), 6 Moderate npm advisories, production/security/financial/legal/user UAT approvals, real LINE/Bank/S3 and independent offsite DR. `pnpm lint` now requires zero warnings. No commit/push/deploy of pre-existing shared WIP. Resume by verifying worktree ownership and carefully staging only verified changes.


## 2026-11-04 independent master audit handoff

Read `docs/IMPLEMENTATION-MASTER-STATUS.md` before continuing: 96 task IDs reconciled. Fresh tests: 15 Domain plus 200 API PASS, typecheck PASS, web build PASS, **lint 0 errors/0 warnings**, API coverage **40.38%** (still below mandatory 80%). Public verified TLS and unsigned-webhook-denial smoke PASS; PostgreSQL 18 applied migrations / 32 public tables; read-only Drizzle preflight 335 columns PASS. Isolated checksum-verified backup → migration 0017 → original recovery PASS; real offsite still BLOCKED because destination/recovery configuration absent, though `age` and `rclone` now installed. Snap Chromium cannot launch on VPS (`snap-update-ns`); no browser E2E pass. Continue high-risk HTTP/integration coverage and approved browser CI runner, without bypassing DB/LINE/security release gates. Preserve all other agents' uncommitted changes. No commit, push or deploy was performed by this audit.

**Canonical progress plan:** [PHASES.md](PHASES.md). Read it before editing or estimating status.

## Latest P7-02 handoff (2026-11-04)
Independent lint cleanup reduced ESLint warnings from 37 to 5 with zero errors. API 76/76 tests, monorepo typecheck and Web build passed. Remaining warnings are in concurrent uncommitted Bulk Billing files (`apps/api/src/index.ts`, `apps/api/src/routes/billing-batches.ts`, `apps/web/src/main.tsx`); coordinate with their owner, do not overwrite. Strict CI zero-warning gate, API 80% coverage and Playwright E2E remain open. No migration 0017 was applied, no DEV deploy was performed. Changes are local and uncommitted.

## P7-03 partial isolation verification (2026-11-04)
`apps/api/scripts/smoke-independent-security.ts` now tests disabled property staff grants, disabled organization memberships, disabled organizations and disabled accounts with deny/restoration checks in addition to existing P1-05 cross-scope, revocation and concurrency tests. Verified PASS on isolated loopback API / synthetic DEV PostgreSQL data. A 61-second limiter window separates bursts without bypassing global 90/min rate limiting. P7-03 remains partial: `account_status` only ACTIVE/DISABLED; SUSPENDED requires a product/schema decision and lease lifecycle edge cases remain. No migration/deploy. Preserve other session's uncommitted Bulk Billing changes.

## Follow-up P7-03 tenant lease/invoice security (2026-11-04)
Expanded `apps/api/scripts/smoke-independent-security.ts` with two synthetic tenants and organizations. Own invoice list/detail = 200, foreign invoice ID in both directions and missing ID = 404, unlinked tenant invoice list empty, closed lease and disabled org suppress invoices, restore enables access. Isolated loopback PostgreSQL/HTTP smoke PASS. Database remains migration 0016 while another session owns uncommitted 0017, so test fixtures use parameterized migration-0016 INSERT columns. No migration/deploy. Pending: suspended/disabled lease policy, former-tenant data access policy, real security/UAT and provider gates. Prior phases P0-P5 remain PARTIAL in `docs/PHASE_COMPLETION_AUDIT.md`.

## 2026-11-04 P0 predecessor gate / schema drift preflight
Read-only command: `corepack pnpm --filter @apartment/api exec tsx scripts/check-db-schema-compatibility.ts`. It currently intentionally FAILS: uncommitted Bulk Billing Drizzle model references 16 columns from missing `billing_batch_runs` and `invoices.billing_batch_run_id`, while DEV DB is migration 0016. This is drift, not authorization to apply 0017 or modify another session's changes. 4 new schema preflight unit tests pass; full API 80/80 and typecheck pass. Backup verify and isolated restore test pass (31 public tables); migration rollback proof and offsite backup still open. Do not claim earlier P0–P5 phases fully completed.

## 2026-11-04 P0 CI preflight added (uncommitted)
`.github/workflows/ci.yml` now runs `apps/api/scripts/check-db-schema-compatibility.ts` immediately after disposable PostgreSQL migration, before HTTP smoke. YAML parse, step ordering, 4/4 targeted tests and API typecheck PASS locally. Remote GitHub Actions run for this new step is not verified. Current DEV DB still misses 17 columns from concurrent uncommitted Bulk Billing migration `0017`; no migration applied. P0 remains PARTIAL for ≥80% meaningful API coverage, branch protection, migration downgrade/rollback proof and offsite DR. Preserve all WIP.

## 2026-11-04 P0 isolated migration proof, NOT deploy approval
Current uncommitted migration 0017 and older migrations applied cleanly to a fresh disposable Docker PostgreSQL 16 instance with synthetic credentials and a loopback-only random port. `scripts/check-db-schema-compatibility.ts` then PASS (335 expected columns, 0 missing). Container was cleaned up; no live DEV DB migrations, WIP commits or deploy. Actual DEV still at migration 0016; avoid applying 0017 while another session owns it. Current API V8 coverage 29.34% lines (below 80%). P0 continues partial for production migration data preservation/rollback, offsite restore, CI required checks and coverage; provider/legal gates remain on P1–P7.

## 2026-11-04 seeded-data migration 0017 rehearsal (safe isolated)
Latest root-only DEV backup restored in temporary PostgreSQL 16 Docker `--network none`; applied 0017 SQL with fail-fast psql on the copy only: PASS, 31→32 public tables, batch invoice column exists, record-count digest across five core tables unchanged. Disposable container removed; live DEV remains unmodified at migration 0016. This is **not** down-migration rollback, row-content preservation proof, offsite DR, application smoke, or production readiness. P0 remains PARTIAL and migration 0017 still owned by concurrent Bulk Billing session. Coordinate before rollout.

## 2026-11-04 backup-based recovery proof (P0, partial)
Isolated no-network PostgreSQL 16: restored protected pre-0017 backup to DB A; five-table original-column content digest matched after applying 0017; a second EMPTY DB B restored from identical backup and exactly matched baseline digest, with new invoice batch column absent. PASS, disposable container removed. Recovery is limited to the backup snapshot: in-place downgrade, post-backup writes, offsite disaster recovery, >=80% API line coverage and branch protection remain open. No shared DEV migration, commit or deploy.

## P0 backup-based recovery rehearsal — 2026-11-04
Added `infra/rehearse-apartment-migration-rollback.sh`. On VPS it verified latest local backup SHA-256, restored into ephemeral isolated PostgreSQL 16 `--network none` using tmpfs, applied pending WIP 0017 only in this disposable DB, then re-restored the verified archive and checked full original row fingerprints across organizations/users/leases/invoices/invoice_lines plus old schema shape. PASS; no DEV migration, external sends, or deploy. This is point-in-time recovery and **does not** prove in-place downgrade or lossless rollback of post-backup writes. Still blocked: offsite DR, required GitHub checks, API >=80% coverage, migration coordination, external UAT/finance/legal. Preserve all other uncommitted WIP.

## 2026-11-04 P0 seeded-data upgrade + recovery improvement
`infra/rehearse-apartment-migration-rollback.sh` now restores latest verified backup to a networkless temporary PostgreSQL container, inserts an **ephemeral organization sentinel**, fingerprints five complete original tables, applies migration 0017 and verifies every fingerprint unchanged. It then re-restores original archive, compares to pre-sentinel original fingerprints, and asserts sentinel was removed. PASS. No DEV migration. GitHub branch protection read returned 403 (integration lacks permission), repository rulesets endpoint showed `[]` and gh CLI absent on VPS. P0 remains open for branch enforcement, ≥80% API line coverage, offsite DR, and post-backup writes/reconciliation policy; no commit/push/deploy or WIP change.

## 2026-11-04 P0/P7 coverage quality gate continuation
In `.github/workflows/ci.yml`, coverage is now enforced rather than informational. Domain minimum 80% lines (actual 100%); API temporary no-regression threshold 29% (actual 29.34%). Both targeted thresholded tests passed locally. API meaningful line coverage ≥80% remains REQUIRED and OPEN; add real HTTP/integration tests and raise threshold, do not treat temporary gate as phase completion. GitHub required checks and offsite DR are not yet verified. Preserve concurrent uncommitted WIP including migration 0017 and never apply to DEV without its owning session.

## 2026-11-04 P0/API coverage service safety increment
Added `apps/api/tests/line-due-reminders.test.ts` (8 tests) covering dry-run no side effects, exact Bangkok date APPLY guard, locked invoice, zero outstanding, pending payment claim, queue idempotency and finite integer paging limit. RED test found NaN/Infinity/fractional limit accepted; fixed in `src/services/line-due-reminders.ts` with `z.number().finite().int()` before limit clamp. API line coverage 29.34%→30.19%; CI floor adjusted to 30%, final ≥80% still OPEN. P0 remains partial for coverage, GitHub required checks, offsite restore and post-backup-write rollback policy. No WIP migration, push, or deploy.

## 2026-11-04 financial-position coverage continuation
Added `apps/api/tests/financial-position.test.ts`: 7 mocked-DB service tests for real financial aggregation logic (gross approved, reversed, credits, settled, missing invoice, invalid/inconsistent ledger, non-eligible adjustments). 7/7 PASS, API V8 line coverage 30.19%→30.55% (1468/4805). CI floor remains 30%, final required ≥80% NOT achieved. P0 blockers: real HTTP/integration coverage, GitHub required checks, offsite DR and post-backup-write recovery policy. Preserve all concurrent uncommitted Bulk Billing/migration 0017 work, no deployment or database writes.

## 2026-11-04 P0–P7 prior-phase audit and P1-01 move-out security tests
All phase checklists reviewed: none of P0–P7 is fully complete/accepted. Newly added `apps/api/tests/lease-move-out-authorization.test.ts` 7 tests with transaction mock; missing property, non-owner, lease missing/ended, room not occupied, and missing water/electric final boundary all fail before updates/inserts. Targeted PASS; API V8 coverage 30.55%→31.15% (1497/4805), temporary CI floor raised to 31%, goal 80% remains open. Do not touch concurrent uncommitted migration 0017/Bulk Billing, deploy or call live providers. P1 needs deposit/refund/former-tenant policy and browser/UAT before acceptance; P2–P7 depend on provider/legal/design/QA gates.

## 2026-11-04 P1-01 move-out negative financial gate continuation
Expanded `apps/api/tests/lease-move-out-authorization.test.ts` to 12 mocked transactional negative tests. New cases prove rejection with no final invoice, with a later invoice, pending payment claim, pending finance adjustment, or any unsettled invoice. All deny before DB writes (targeted 12/12 PASS). API V8 coverage 31.65% (1521/4805), still below required 80%. No DEV DB migration, commit/push, or deploy. P0–P7 still have external/legal/security/UAT gates; another session owns WIP `0017` Bulk Billing.

## 2026-11-04 P4 LINE outbox queue fairness fix
Added test-first regression to `apps/api/tests/line-fairness.test.ts`: at equal per-org usage, unknown queue age should never outrank known older queued work. RED was reproduced, fix in `apps/api/src/services/line-fairness.ts` uses `Infinity` for null timestamp in comparator, then GREEN 3/3. API V8 lines 31.66% (1522/4806), still <80%. P0–P7 remain PARTIAL due to provider, finance/legal, browser, CI and offsite gates. Preserve shared uncommitted Bulk Billing migration 0017; no live DEV migration, commit/push, deploy or LINE delivery.

## 2026-11-04 P0 offsite backup coding continuation
New root-only scripts `infra/offsite-apartment-postgres.sh` and `infra/retrieve-offsite-apartment-postgres.sh` implement age-encrypted immutable rclone transfer plus checksum readback, and authenticated safe recovery to protected PostgreSQL archive (not live DB). Shell tests `infra/tests/offsite-apartment-postgres.test.sh` validate eight denial/preflight paths with no actual upload. `docs/OFFSITE_BACKUP.md` lists age/rclone binary installation, offline age private identity and rclone remote prerequisites. Neither tool nor remote configured on VPS, so real offsite backup/restore acceptance is NOT done. P0 also remains open for >=80% API coverage and GitHub required checks; keep concurrent Bulk Billing migration 0017 and other uncommitted changes untouched. User will set LINE ENV later; never block coding tasks solely on LINE secrets.

## 2026-11-04 optional offsite shipping scheduler
Repository-only `infra/systemd/apartment-postgres-offsite.service` and `.timer` implement a fail-closed optional offsite shipping schedule (04:30 Asia/Bangkok). Requires `/etc/apartment/offsite.env`, age/rclone, protected dedicated remote; `systemd-analyze verify` and calendar parsing PASS. **Timer was NOT installed, enabled or started.** Additional offsite script tests now 8/8 no-upload PASS. See `docs/OFFSITE_BACKUP.md` and `docs/CODING_PHASE_BACKLOG.md` for operator/deferred LINE setup and coding gaps. P0–P7 remain partial until actual acceptance.

## 2026-11-04 P0 fail-closed encrypted offsite uploader integration checks
Added `infra/tests/offsite-upload-mock.test.sh`, a root-only local-VPS fake-age/fake-rclone orchestration test using existing checksum-verified backup as read-only input. Verified the ciphertext-before-send stub path, immutable remote object collisions, corruption detected by remote hash readback, encryption failure stops upload, and upload failure stops success reporting. PASS, no external remote or live DB writes. Updated CI bash syntax gate and `docs/OFFSITE_BACKUP.md`. **This does not constitute real age cryptography, S3/rclone interop or offsite recovery.** Next coding areas remain P0 API line coverage >=80% (currently 31.66%), P1 deposit/refund/tenant policy and browser E2E, then P2–P7 per `docs/CODING_PHASE_BACKLOG.md`. Migration 0017 belongs to concurrent session; do not introduce a conflicting 0018 migration or apply to shared DEV. LINE secrets setup deferred per user.

## 2026-11-04 P1 progress — deposit accounting preview + former-tenant history routes/UI
Implemented deposit-settlement preview-only policy (7 tests; zero implicit payouts) and former-tenant historical invoice authorization policy (7 tests), new scoped GET `/v1/tenant/history/invoices` and `/:invoiceId` Fastify routes (6 HTTP injection tests) and read-only TenantPortal historical view (no payment controls for ended lease). Ended-lease invoice visibility requires account active and verified LINE subject, matching organization/property and invoice entirely inside contract dates; `no-store`. Typecheck and focused tests PASS. Actual persisted deposit schema, backend review API/UI, provider/browser acceptance and real bank/refund workflows remain OPEN. Avoid concurrent uncommitted migration 0017 and preservation-sensitive files. API coverage 33.50%, temporary CI floor 33%, final >=80% still open. LINE ENV remains deferred as requested; P0–P7 coding and acceptance remain partial.

## 2026-11-04 P2–P6 additional coding checkpoint
P2 mocked claim and explicit owner approval Fastify tests 8/8 pass without LINE keys. P3 real owner-scoped receivables CSV endpoint with safe CSV serializer and repeatable-read accounting transaction; 10 tests pass, max 500 records or explicit error, no-store. P5 scoped read-only meter anomaly preview endpoint and classifier; 12 tests pass; no automatic billing. P6 keyboard focus ring/reduced-motion CSS passes web build. P1 former tenant history and deposit preview as above. API V8 line coverage now 37.08% (1892/5102), CI floor 37%, required >=80% still NOT met. P1 deposit persistence needs coordinated migration **after** another session's uncommitted 0017. No LINE ENV work requested from user now. Never claim P0–P7 code-complete or production-ready until real E2E/provider/security/legal gates pass.

## 2026-11-04 P1/P5 coding continuation — canonical lease billing, privacy export, occupancy reconciliation
Added `requirePropertyAdministrator` shared guard with four security tests and owner overview `PropertyOperationsReports` UI (occupancy reconciliation, report loading/alerts and receivables CSV). Implemented owner-scoped no-write mid-cycle billing segment preview (monthly/semi-monthly/rolling every 15 days), pure + HTTP tests 11/11. Implemented tenant subject-bound privacy JSON export route, no-store, rate-limit and 100/500 caps with TenantPortal UI download; HTTP 7/7. Implemented scoped read-only occupancy report in repeatable-read snapshot; domain+HTTP tests 10/10. API line coverage 39.68% (2117/5335), temporary CI floor 39; final >=80% still OPEN. All routes registered in index. No commit/push/deploy or shared DEV migration. Migration 0017 and Bulk Billing are another session's WIP. Do not mark phases complete without production/live provider/browser QA and financial policies; user will configure LINE ENV later.

## 2026-11-04 safe P4 observer service readiness
Added opt-in `infra/systemd/apartment-line-outbox-observer.service` for the existing continuous `apps/api/scripts/line-outbox-worker.ts`. Process command hard-overrides LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false, LINE_OUTBOUND_MODE=disabled regardless of EnvironmentFile values; CI grep guard and `systemd-analyze verify` pass. Service is NOT installed/enabled and does NOT deliver LINE messages. User will set LINE ENV later. Continuous live sends require independent approval, secure provider credentials and explicit separate deployment. Preserve other session's worker code and migration 0017 WIP.

## Mission

Continue the Apartment LINE-first multi-tenant SaaS in `/root/Projects/Apartment`.

**2026-11-04 Apartment DEV runtime recovery:** After reboot, Web Container and Web Image were missing. Rebuilt Web + API images using a clean `git archive HEAD` at `113c329` (no uncommitted Bulk Billing), restored only Apartment Web/API/observe-only Worker. Pre-deploy Apartment-only checksum-verified backup: `apartment-20261104T011719Z-360623.dump`. Internal 18089 homepage/readyz 200, unauthenticated STAFF API 401, all Apartment app containers Healthy, Worker dispatched=0 and external LINE disabled. **Public HTTPS is DOWN** because shared Traefik is absent. Do NOT restart shared proxy as an Apartment session; coordinate authorized infrastructure recovery and ACME persistence. See `docs/DEPLOY_DOKPLOY_DEV.md`.

**2026-11-04 QA/security update:** GitHub-hosted CI Run `41750529389` passed 2/2 jobs for commit `c908f1c`. The new ESLint/Vitest coverage/High+Critical dependency audit checks and workspace patched overrides passed GitHub-hosted Run `41751709175` (commit `f9c9e54`); subsequent 4 Domain boundary tests added locally. Measured API line coverage 29.28%, Domain lines 100%/branches 96.42%, ESLint 0 errors/37 warnings, pnpm Audit 0 Critical/High (6 Moderate). See `docs/P7_CI_RUNBOOK.md` and `docs/P7_DEPENDENCY_AUDIT.md`. P5 Bulk Billing / migration 0017 remain another session’s uncommitted work; do not stage/reset/apply during independent QA.

**2026-11-04 phase audit:** Previous phases P0–P5 are **not fully complete**; owner/tenant browser UAT, LINE sandbox, real bank/S3 evidence, tax/deposit policies and final P1-05 acceptance remain open. See `docs/PHASE_COMPLETION_AUDIT.md`. Controlled 60-second P1-05 STAFF permission soak passed; run `P105_SOAK_SECONDS=60 corepack pnpm --filter @apartment/api exec tsx scripts/soak-security.ts` after confirming the dedicated DEV database. See `docs/P1_P105_SOAK.md`.

**P7-02 CI gate (partial, new work):** `.github/workflows/ci.yml` and `docs/P7_CI_RUNBOOK.md` provide PR/push unit/types/build and isolated PostgreSQL migration/HTTP security tests; verify actual GitHub Actions results and branch protection. Current shared tree contains unrelated uncommitted P5 Bulk Billing schema (`0017`); direct smoke against DEV DB at migration `0016` fails with missing `invoices.billing_batch_run_id`, not because P1-05 bounds failed. Do not apply another session’s uncommitted migration as part of CI changes; the disposable CI Postgres applies checked-in migrations, so catch migration/DDL drift before DEV rollout.

**P1-05 additional independent QA has been executed:** 16 duplicate meter writes one-winner, 48 concurrent mixed-scope reads, revoked access denied; see `docs/P1_P105_INDEPENDENT_QA.md` and repeat using `corepack pnpm --filter @apartment/api exec tsx scripts/smoke-independent-security.ts`. This work was done in the same worktree, preserving any concurrently uncommitted Bulk Billing changes. Longer soak and independent final acceptance remain open.

**Current next phase: P1-05 security/edge/load gates after P1-04 staff access.** P1-04 adds OWNER-only manager/staff invitations, property grants, safe read/write scopes and owner/staff React UI (migration 0015, real PostgreSQL smoke). See `docs/P1_STAFF_ACCESS.md`. Then P1-01b/P5 maintenance/deposit workflows. P4-05 real LINE Login/LIFF and Messaging Sandbox E2E still require provider credentials and acceptance; never activate live messaging without real consent/privacy/provider verification.

**P3-02b.6 DEV code completed:** manual dry-run-first cleanup with Legal Hold, EXPIRED retry state and no Payment Claim deletion; optional fail-closed ClamAV TCP INSTREAM adapter. Production gating, actual scanner, lifecycle, admin retention and scheduler are still NOT done. Read docs/P3_EVIDENCE_RETENTION_MALWARE.md.

**P3-01b PromptPay QR implemented in DEV:** read `docs/P3_PROMPTPAY_QR.md`. BOT/EMV Tag 29 payload+CRC golden test, tenant and owner scoped API, local browser QR image + refresh/download, fixed outstanding amount and pending/full-payment guards passed. Real bank-app scan / recipient name verification is **not yet done**, so keep the overall P3-01b checkbox pending external sign-off. No payment is marked paid automatically.

**P3-05b is implemented in DEV:** scoped owner and linked tenant can download an A4 Thai Billing Notice PDF with immutable invoice-line amounts and an issuance-time snapshot of issuer/property/address/room/tenant. Historical invoices without snapshots display a clear current-record metadata warning. This document is **NOT** a payment receipt or tax invoice. See docs/P3_PDF_RECEIPT_SPEC.md.

P3-02b Signed S3 upload code is implemented for DEV and passes `smoke:s3` using a local HTTP mock with actual PostgreSQL. It is **NOT yet verified against a real cloud/S3-compatible provider**, so P3-02b remains unchecked. When the user configures storage ENV, validate provider IAM + SigV4 signature verification, CORS, browser LIFF flow, lifecycle, malware scan, restore and security review. See `docs/P3_S3_STORAGE_RUNBOOK.md` and `docs/ENV_REQUIRED.md`.

**Do not assume that a manually approved slip proves receipt of money.** Ledger postings are manually reviewed only; invoice status remains ISSUED. Do not send real bank transactions or auto-mark PAID.



## P1-04 latest implementation (read before continuing)
**Live note after 2026-11-03 reboot:** Git `d259c94` is pushed and Apartment managed API/Web/LINE observer are Healthy on private 127.0.0.1:18089, migration 0015 applied. Public HTTPS is NOT reachable: shared `dokploy-traefik` exited (255), host 80/443 closed and its dynamic/ACME mounts were read-only. This is shared infra: DO NOT restart it under an Apartment feature session. Coordinate safe ACME/certificate persistence repair and verify other sites before restarting/recreating the proxy. No live LINE sends.
- Source: `apps/api/src/routes/staff.ts`, `apps/api/src/services/staff-permissions.ts`, `apps/api/src/security.ts`, `apps/api/drizzle/0015_bright_loki.sql` and owner/STAFF UI `apps/web/src/components/StaffManagement.tsx`.
- Test: `corepack pnpm --filter @apartment/api smoke:staff` (real PostgreSQL & HTTP), unit + typecheck + web build and all existing smoke suites. Never grant STAFF the generic `requireProperty` read access; property read must explicitly opt in through `STAFF_READ`.
- Owner must confirm recipient identity before approval. Live LINE provider remains OFF and Production unavailable until real E2E and security/legal acceptance. See `docs/P1_STAFF_ACCESS.md`.

## First commands

```bash
cd /root/Projects/Apartment
git status --short --branch
git log -1 --oneline
cat AGENTS.md
cat docs/PHASES.md
corepack pnpm test
corepack pnpm typecheck
corepack pnpm --filter @apartment/web build
docker compose --env-file .env -f infra/compose.dev.yaml ps
corepack pnpm --filter @apartment/api smoke
corepack pnpm --filter @apartment/api smoke:http
corepack pnpm --filter @apartment/api smoke:payments
corepack pnpm --filter @apartment/api smoke:finance
corepack pnpm --filter @apartment/api smoke:s3
corepack pnpm --filter @apartment/api smoke:cleanup
corepack pnpm --filter @apartment/api evidence:cleanup  # DRY RUN ONLY
corepack pnpm --filter @apartment/api exec tsx scripts/preview-billing-pdf.ts
corepack pnpm --filter @apartment/api exec tsx scripts/preview-billing-pdf.ts --long
```

Do **not** execute `db:migrate` blindly on any shared or production DB; this is a dedicated local DEV database. New migrations must be reviewed first.

## What exists and where

- `apps/api/src/index.ts`: owner, rooms, leases, meter, billing, compliance endpoints and root Fastify setup.
- `apps/api/src/routes/tenant.ts`: secure invite owner generate/revoke, tenant claim, owner manual approval, tenant-only lease and invoice APIs.
- `apps/api/src/services/invitations.ts`: CSPRNG 256-bit token and domain-separated SHA-256 hash with 24h expiry.
- `apps/api/src/db/schema.ts`: 12 tables incl. lease invitations; Drizzle migrations 0000/0001/0002.
- `apps/api/src/security.ts`: verified DB session, org membership and property access checks.
- `apps/api/scripts/smoke-http.ts`: real HTTP with test sessions, invoice idempotency, tenant isolation and invite race/expiry tests.
- `apps/web/src/components/OwnerInvitations.tsx`: generate/copy invite and manually approve claimant.
- `apps/web/src/components/TenantPortal.tsx`: pending claims, own leases, own invoice lines.
- `docs/PHASES.md`: source of truth, each phase's checkbox and acceptance gate.
- `docs/ENV_REQUIRED.md`: keys needed for real LINE Login and **now-supported S3 driver**, plus future-only OA keys.
- `docs/P3_S3_STORAGE_RUNBOOK.md`: storage threat model, private bucket IAM/CORS and lifecycle policy.
- `docs/P3_PDF_RECEIPT_SPEC.md`: Billing Notice vs official receipt/tax restrictions and PDF acceptance.
- `apps/api/src/routes/evidence-uploads.ts`: create signed quarantine ticket, finalize/sanitize, create claim transactionally from uploaded evidence.
- `apps/api/src/services/evidence-s3.ts`: AWS SDK S3 adapter with presigned PUT and bounded reads.
- `apps/api/scripts/smoke-storage-s3.ts`: real Postgres + local HTTP S3 mock integration; **not** proof of provider SigV4/IAM.
- `apps/api/src/routes/payments.ts`: banking instructions, tenant evidence claims, owner manual reviews, ledger.
- `apps/api/src/services/evidence.ts`: DEV-only sanitized WebP private storage.
- `apps/api/src/services/payment-rules.ts`: integer satang, overpayment reject and reference rules.
- `apps/api/scripts/smoke-payment-concurrency.ts`: invoice lock and one-winner owner review.
- `apps/web/src/components/PaymentCenter.tsx`, `TenantPayments.tsx`: owner and tenant payment screens.

## P2 state / known blockers

- Locally implemented and verified: invite+approval+read-only tenant portal and database migration, unit tests, actual Postgres/HTTP smoke. Invoice visibility only **after** owner approval.
- Not verified: actual LINE Developers sandbox login + LIFF integration + external HTTPS, visual browser E2E. The local HTTP smoke uses temporary DB sessions and is **not** real LINE E2E.
- P3 has DEV-only Ledger and owner manual review plus S3 presigned quarantine PUT **code** (mock E2E verified). No live provider validation, malware scanner, object lifecycle worker, bank verification, receipts/PDF, PromptPay QR, or background jobs.
- For Figma creation the user still needs to select a workspace/team; do not assume the organization's team.

## End-of-session policy

Before declaring phase work complete, run tests/typecheck/build/database smoke, document verified evidence and any blocked work. Update both `docs/PHASES.md` (canonical) and `docs/implementation-status.md` (summary). Commit only your finished code with no secrets, no remote push/deploy without authorization. Never use bypass flags or rewrite someone else's changes.


## P3-05b implemented files
- apps/api/src/services/billing-notice-pdf.ts — dynamic PDFKit A4 renderer with embedded Noto Sans Thai from npm, guarded totals, multiple pages, and clear non-receipt/non-tax notice
- apps/api/src/routes/billing-documents.ts — private no-store owner/tenant downloads with property/invoice scope
- apps/api/tests/billing-notice.test.ts — PDFJS Thai text, total invariants, legacy warning and long-row pagination tests
- apps/api/scripts/preview-billing-pdf.ts — reproducible PDF+PNG visual review, optional --long
- apps/api/drizzle/0006_mushy_magdalene.sql — invoice document_snapshot and invoice line ordinal


## PromptPay P3-01b source map
- `apps/api/src/services/promptpay.ts` — BOT/EMV credit-transfer Tag 29 builder, CRC16-CCITT-FALSE, phone/tax proxy validation
- `apps/api/src/routes/promptpay.ts` — tenant/owner invoice-scoped no-store display-only payload endpoints
- `apps/api/tests/promptpay.test.ts` — golden vector and invalid identifier/money tests
- `apps/web/src/components/PromptPayQRCode.tsx` — browser-only QR pixels via lazy `qrcode`, download and refresh
- `apps/web/src/components/TenantPayments.tsx`, `PaymentCenter.tsx` — tenant bill and owner invoice preview integrations
- `apps/api/scripts/smoke-http.ts` — real PostgreSQL, identity/IDOR, pending/full and partial payments QR smoke.

P3-02b.6 files: apps/api/src/services/malware-scanner.ts, services/evidence-cleanup.ts, scripts/cleanup-evidence.ts, scripts/smoke-evidence-cleanup.ts, tests/malware-scanner.test.ts, tests/evidence-cleanup.test.ts, apps/api/drizzle/0007_mixed_christian_walker.sql.

## DEV handoff 2026-11-03
- GitHub: git@github.com:natthaphonKhaokkaeo/Apartment.git, main.
- Docker Compose DEV web + API on VPS loopback 127.0.0.1:18088; /readyz 200 and unauthorized API 401. **Not Dokploy-managed** (Dokploy API 401 without x-api-key).
- Deployment files: docker-compose.dokploy.yml, infra/Dockerfile, infra/nginx.dev.conf; runtime secrets at /etc/dokploy/runtime-env/apartment-api.env (mode 0600, untracked).
- Existing PostgreSQL reused via apartment-dev_default network; no duplicate database.
- P3 finance: apps/api/src/routes/financial-adjustments.ts, services/financial-position.ts, services/financial-rules.ts, tests/financial-rules.test.ts, scripts/smoke-financial-adjustments.ts, Drizzle 0008, apps/web/src/components/FinancialAdjustmentCenter.tsx.
- Documents: docs/DEPLOY_DOKPLOY_DEV.md and docs/P3_FINANCIAL_ADJUSTMENTS.md.
\n## Latest P4-01/02/03 DEV implementation\n- apps/api/src/services/line-oa.ts, line-outbox.ts, routes/line-oa.ts, scripts/dispatch-line-outbox.ts, scripts/smoke-line-oa.ts and tests/line-oa.test.ts. Drizzle 0009.\n- docs/P4_LINE_OA_WEBHOOK_OUTBOX.md has threat model, exact key list, state/retry definitions and pending gates.\n- Dokploy record: Project Apartment, Environment dev, Compose Apartment DEV, id E62Ag2umCDl9Q2ChzGOPB; configured Git HTTPS main and Compose path. **Running Healthy under Dokploy.** Port 18089 bound to loopback; old standalone 18088 was shut down safely after confirmation.\n
Latest managed deployment proof: Dokploy composeId E62Ag2umCDl9Q2ChzGOPB status done; Docker project apartment-dokploy-dev-ajcnbm API/Web both healthy; 18089 web/readyz 200 and unauthenticated auth guard 401; old Compose 18088 stopped. Need redeploy with latest P4 commit before LINE webhook code is in running images.

P4 rollout gate: source commit 3fd4fb6 pushed, but running Dokploy images are still pre-P4 (webhook 404). Current runtime WEB_ORIGIN=18088 conflicts with managed host port 18089; private runtime ENV file already corrected to 18089, requires authenticated Dokploy Dashboard Redeploy. See docs/DEPLOY_DOKPLOY_DEV.md. Do not claim new P4 route live until verified 503 when no secret and origin guard normal.

Domain checkpoint: https://apartme.makemarket.space now works (HTTPS trusted; web/readyz=200, unauthorized=401, correct-origin POST=200, unsigned OA webhook=503). Runtime WEB_ORIGIN matches domain and Secure Cookie enabled. Important unresolved infrastructure issue: shared Traefik ACME bind is read-only and acme.json empty, so do NOT restart shared Traefik until certificate persistence/renewal is repaired with a maintenance plan. See docs/DEPLOY_DOKPLOY_DEV.md. LINE credentials still missing.

## P4-04 tenant consent and invoice notifications (DEV)
- API routes: apps/api/src/routes/line-consent.ts (GET own preferences; PUT opt-in/revoke, explicit policyVersion + affirmative acknowledgment; cross-tenant IDOR blocked)
- Service: apps/api/src/services/line-notifications.ts (generic Thai messages; transactional consent-bound BILL_ISSUED/PAYMENT_DUE outbox entries)
- Due CLI: apps/api/src/services/line-due-reminders.ts and scripts/prepare-line-due-reminders.ts (Bangkok date, organization-specific dry-run by default, exact due date, outstanding and pending-claim checks, queue only)
- UI: apps/web/src/components/TenantNotificationPreferences.tsx integrated in TenantPortal.
- Test: apps/api/tests/line-notifications.test.ts and apps/api/scripts/smoke-line-consent.ts; run corepack pnpm --filter @apartment/api smoke:consent.
- No DB migration necessary; reuses LINE schema from 0009. Real OA/LIFF credentials missing; LINE_OUTBOUND_MODE=disabled, no automated or real sending.
- Handoff spec: docs/P4_TENANT_CONSENT_NOTIFICATIONS.md.

## P4-04 managed DEV deployment verification — 2026-11-03
- P4-04 code commit d01e1c2 is pushed to GitHub main and Docker API/Web images were rebuilt and recreated in existing Dokploy Compose project apartment-dokploy-dev-ajcnbm (NO other projects touched).
- Public https://apartme.makemarket.space/ and /readyz return 200 with trusted TLS; GET /v1/tenant/notification-consents and unauthenticated PUT both return 401; unsigned /v1/line/oa/webhook returns 503 because real LINE secret remains unconfigured.
- API route source is present in managed container; LINE_OUTBOUND_MODE defaults to disabled and NO messages were sent.
- CLI safe dry-run tested; trying --apply without --confirm-queue-only fails. PostgreSQL remains Healthy with 22 tables (no migration needed).
- Keep P4-04 marked PARTIAL for invitation/repair templates and real LINE provider/consent acceptance. Traefik ACME storage durability issue remains as documented.

## P4-03c observer / Dead-letter operations
- apps/api/src/services/line-operations.ts, routes/line-operations.ts and scripts/line-outbox-worker.ts; new migration 0010 dead-letter review records.
- apps/web/src/components/LineOperationsAdmin.tsx shown to Platform Super Admin only; endpoints return no recipient or message contents.
- Dokploy Compose adds line-observer with LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false and LINE_OUTBOUND_MODE=disabled, heartbeat health, private DB network only.
- Run smoke:line (admin status and Dead-letter review), line:worker --once and full regression. Live LINE provider still blocked. See docs/P4_LINE_OPERATIONS.md.

## P4-03c verified deployment checkpoint 2026-11-03
- Feature commit 983fd6b pushed to GitHub main; built images and Docker Compose updated within existing Dokploy project apartment-dokploy-dev-ajcnbm without modifying other services.
- Managed services api/web/line-observer all Healthy; apartment-dev-postgres-1 Healthy and database 23 tables, migration 0010 applied.
- Public https://apartme.makemarket.space and /readyz 200 with TLS verify=0; both unauthenticated operator endpoints 401.
- line-observer mode observe, approved false, outbound disabled, poll 60s, heartbeat age 11s, dispatched 0. Dedicated no-port worker is running but does NOT send.
- 59 tests + all regression suites + Vite/TypeScript + LINE worker one-shot passed. No LINE live provider keys are configured.
- Docs/P4_LINE_OPERATIONS.md contains operator monitoring endpoints, restrictions, remaining quota/alert/consent live gates.

## P4-03d quota/fairness and internal alerts DEV
- API modules: src/services/line-fairness.ts, line-alerts.ts, line-outbox.ts (PostgreSQL global advisory transaction lock and reserved attempt table), line-operations.ts (per-org window usage), routes/line-operations.ts (scoped alert list/ack).
- Worker: scripts/line-outbox-worker.ts now reconciles internal alerts in OBSERVE mode on each heartbeat; never sends LINE.
- New schema migration 0011: line_dispatch_reservations and line_ops_alerts (unique open incident per org/kind).
- UI: apps/web/src/components/LineOperationsAdmin.tsx displays quota-window usage and active internal incidents; acknowledgment does not retry.
- Tests: tests/line-fairness.test.ts + extended scripts/smoke-line-oa.ts for concurrent quota and durable alert lifecycle.
- No external alerts, no real LINE deliveries, multi-channel fairness/retention/consent in-flight gates remain pending. See docs/P4_LINE_QUOTAS_ALERTS.md.

## P4-03d verified managed deployment
- Feature commit 826550c, Compose quota setting commit 9295d2e both pushed to GitHub main. Existing Apartment Dokploy project rebuilt/recreated the API/Web and Observer only.
- PostgreSQL has 25 tables, migration 0011 applied. All 61 unit tests and full existing smoke suites passed.
- Public https://apartme.makemarket.space/ and /readyz 200, TLS verify 0; unauthenticated /v1/admin/line-operations/alerts 401.
- API, Web, Observer, old Postgres all Healthy; observer heartbeat age 18s, LINE_WORKER_MODE observe, LINE_WORKER_APPROVED false, LINE_OUTBOUND_MODE disabled, quota env perorg=5/global=20, dispatched=0.
- Incidents are INTERNAL database + admin UI only; no paging/no real LINE messages, and external LINE Provider quota is still unverified. Keep P4-05 Sandbox and provider acceptance gate pending.

## P4-03e consent race + reservation retention / PostgreSQL backup (2026-11-03)
- apps/api/src/services/line-outbox.ts: LIVE path revalidates active lease -> enabled OA -> active matching consent using FOR SHARE locks while the bounded provider call executes; tenant revoke uses lease/consent FOR UPDATE. A revoked consent stops future new dispatches. Existing in-flight calls cannot be recalled, and a revoke in progress may wait for the provider request (up to 7s in real LINE HTTP). Never claim absolute delivery cancel.
- apps/api/src/services/line-retention.ts and scripts/cleanup-line-reservations.ts: org-scoped 30-day reservation retention; dry-run default, confirmed apply max 100 rows per CLI invocation. Manual only; no automatic cleanup timer. Real PostgreSQL smoke verifies organization scope and bounded deletion.
- infra/backup-apartment-postgres.sh, infra/systemd/apartment-postgres-backup.{service,timer}, docs/POSTGRES_BACKUP_RESTORE.md. Enabled real VPS systemd timer daily 03:30 Asia/Bangkok. Source Docker volume unchanged. Verified live pg_dump custom format, SHA-256 and full restore to temporary postgres:16 container with --network none (25 public tables), not production DB.
- Physical data is still on the SAME VPS. Offsite encrypted copy, backup success notification and independent restore test are not configured. Do not claim disaster recovery readiness.
- Read docs/P4_LINE_RETENTION.md and docs/POSTGRES_BACKUP_RESTORE.md.

## Final P4-03e + database backup DEV validation (2026-11-03)
- Feature commit b0d55eb pushed to main; existing Apartment Dokploy project rebuilt and updated API/Web/line-observer only. All three containers and PostgreSQL Healthy.
- Public HTTPS/readyz 200 with valid TLS (verify 0); unauthenticated alerts API returns 401. Observer heartbeat fresh (8s), LIVE worker OFF: observe/approval false/outbound disabled.
- systemd apartment-postgres-backup.timer ACTIVE with next 2026-11-04 03:30:00 Asia/Bangkok; backup service manual execution SUCCESS. Root-only /root/backups/apartment-postgres backup files have SHA-256, backup script verify PASS, restore to independent ephemeral PostgreSQL 16 network-none container PASS (25 public tables); no DB downtime. Need OFFSITE backup before Production.
- 63 unit tests + API/finance/payment/S3/cleanup/LINE suites/typecheck/web build PASS; P4-03e live consent race and reservation retention smoke PASS.
- P4-05 LINE provider Sandbox/login/LIFF E2E awaits actual credentials; no real sending. Shared Traefik ACME read-only bind still needs risk-controlled maintenance. See docs/POSTGRES_BACKUP_RESTORE.md and docs/P4_LINE_RETENTION.md.

## P1-01a owner move-out / lease closure (DEV)
- Code: apps/api/src/services/lease-lifecycle.ts, apps/api/src/routes/lease-lifecycle.ts, registered in index.ts; owner Rooms UI in apps/web/src/main.tsx.
- Strict gates: active owner org membership (not manager/admin override), exclusive end date after start and <= Bangkok today, final water+electric readings, final ISSUED invoice exactly at boundary, all issued invoices settled, no pending payment/finance requests. Property->lease->room transaction locks shared property lock with invoice issuer.
- Success: ENDED lease/endDate, room AVAILABLE or MAINTENANCE, revoke invitations, LINE consents and queued/retry/sending Outbox; audit. No existing invoice or ledger mutated.
- Test: apps/api/tests/lease-lifecycle.test.ts and extended apps/api/scripts/smoke-line-consent.ts with owner/manager/IDOR, pending/unsettled, retry, LINE revoke and room reuse.
- No DB migration needed. P1-01b maintenance repair/deposit, P1-02 effective-dated rates and P1-03 midcycle invoices, former-tenant history remain pending. Read docs/P1_LEASE_MOVE_OUT.md.

## P1-01a deployed DEV validation
- Feature commit f94e6a4 pushed. Existing Dokploy Apartment DEV API/Web/Observer rebuilt and Healthy, PostgreSQL Healthy and backup timer active.
- Public HTTPS/readyz 200 with valid TLS; unauthorized move-out POST 401; LINE observer outbound disabled.
- 64 unit tests (11 domain, 53 API), full payments/finance/S3/LINE/cleanup HTTP and PostgreSQL smoke, TypeScript, Vite and Compose checks passed.
- No migration. P1-01b repair, deposits, midcycle and former-tenant history still pending. Continue P1-02 rate history and P1-03 prorating next.

## P1-02 verified DEV handoff
- Commit 2b6897e pushed to main and deployed in Dokploy Apartment DEV.
- New property_rate_versions migration 0012 (1900-01-01 historical baseline; new-property trigger) applied, no old invoices changed.
- API GET/POST /v1/properties/:propertyId/rates; only ACTIVE OWNER can schedule complete property rate versions, no past dates or mid-period changes, no unreviewed utility ceilings/future-issued conflicts.
- Billing resolves effective version at period start; RENT/WATER/ELECTRIC snapshots store rate version ID; Settings displays price history.
- Full tests PASS: 66 unit tests, real PostgreSQL rate-scope/snapshot smoke, payment/finance/LINE/S3/cleanup and frontend build.
- Public HTTPS and /readyz=200, new rate endpoints unauthenticated 401, API/Web/Observer/Postgres healthy; backup timer active; no real LINE sends.
- Next P1-03 partial-period invoices, historical room overrides and meter replacement; legal notices and scheduled rate correction pending.

## P1-03a/b room rates and move-in partial billing (DEV)
- Migration 0013_numerous_joseph.sql: room_rate_versions backfill and new-room trigger, legacy historical rate inferred only at migration baseline. No prior invoice modified. This is 27th public table.
- API: routes/room-rates.ts, services/room-rates.ts; GET/POST by room, OWNER-only future canonical billing boundary, no backdate/cap exceed/future-issued invoice conflict. Existing PATCH room overrides rejected; room number still patchable.
- Billing: services/billing.ts joins effective property and room version by periodStart; new invoice line snapshots store both version IDs. Explicit partialMode MOVE_IN accepts only actual lease.startDate to canonical period end, with real meter readings and existing compliance checks; invoice issue checks overlapping ISSUED lease periods.
- Web: owner room dated-override scheduling, on-demand history, Billing full vs move-in-partial choice.
- Tests: tests/room-rates.test.ts, billing-partial.test.ts and extended real PostgreSQL HTTP smoke-http.ts.
- NOT COMPLETED: meter replacement, partial MOVE_OUT, refunds/deposits, historical room amendments and P1-04 staff. See docs/P1_PARTIAL_BILLING_AND_ROOM_RATES.md.

## Verified P1-03a/b Dokploy DEV rollout (2026-11-03)
- Feature commit ccbd4fb pushed to origin/main, existing Apartment DEV API/Web/Observer rebuilt/recreated, all Healthy; PostgreSQL still Healthy with 27 tables after migration 0013.
- Public https://apartme.makemarket.space/ and /readyz both 200 with TLS verification 0. Unauthenticated room-rates GET and MOVE_IN bill preview both 401.
- LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false, LINE_OUTBOUND_MODE=disabled; no actual LINE messages sent.
- Verified root-only PostgreSQL backup before migration; apartment-postgres-backup.timer active, next 2026-11-04 03:30 Asia/Bangkok.
- 70 Unit Tests (11 domain + 59 API) and full PostgreSQL/payment/finance/LINE/S3/cleanup smoke, TypeScript, frontend build, Compose validation passed.
- NEXT: P1-03c meter-replacement serial/closing/opening readings and mid-cycle MOVE_OUT safe billing; P1-04 staff authorization after. DO NOT mark P1/P1-03 complete or enable live provider.

## P1-03c meter replacement and final MOVE_OUT (DEV)
- apps/api/src/services/meter-replacement.ts, routes/meter-replacement.ts; migration 0014_shiny_baron_zemo.sql and new meter_replacements table.
- Meter replacement is OWNER-only: append serials, readings, evidenceRef, reason, audit; new meter opening reading inserted same day. Historical invoice, ledger and old readings are not rewritten. No verified physical photo upload yet: evidenceRef is operator-supplied only.
- services/billing.ts resolves meter replacements inside (start,end], sums segment usage with 0-reset handling, immutable snapshot IDs/values. Normal read monotonicity is now per meter segment.
- MOVE_OUT partial bill mode only from canonical period boundary or original leaseStart to the actual past/today handover boundary inside that period. No overlapping issued invoices, previous rate/reading/legal guards still apply.
- Owner moveOutLease remains a separate explicit step requiring fully paid last invoice, no pending finance/payments and physical handover. No automatic deposit refund/credit.
- Owner Meter UI has swap form and on-demand history. Billing UI exposes MOVE_OUT partial. See docs/P1_METER_REPLACEMENT_MOVE_OUT.md.
- Test: meter-replacement.test.ts, billing-partial.test.ts and extended smoke-http.ts with swapped water meter, final invoice/approved payment/lease close.
- Open: evidence validation, deposit settlement, offsite backup, P1-04 staff invitations and P1-05 load/security verification.

## Verified P1-03c Dokploy DEV rollout (2026-11-03)
- Git feature fc4ed64 pushed to origin/main. Existing Apartment DEV API/Web/line-observer rebuilt and recreated Healthy, PostgreSQL Healthy (28 tables). Other VPS services untouched.
- https://apartme.makemarket.space/ and /readyz = 200 with TLS verification 0. Unauthenticated /meter-replacements GET and MOVE_OUT bill preview POST return 401.
- LINE_WORKER_MODE observe, LINE_WORKER_APPROVED false, LINE_OUTBOUND_MODE disabled. No real LINE dispatch.
- 75 unit tests (11 domain + 64 API), full existing PostgreSQL HTTP, payment, finance, S3, cleanup, LINE, TypeScript, React build and Compose tests passed. Pre-migration backup checksum verified.
- apartment-postgres-backup.timer active, next 2026-11-04 03:30 Asia/Bangkok. Backups still only on same VPS, offsite recovery remains pending.
- NEXT: P1-04 staff roles/invitations/revocation, P1-05 security/load gates, P1-01b repairs/deposit and formal legal/evidence acceptance. See docs/P1_METER_REPLACEMENT_MOVE_OUT.md.

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

## 2026-11-05 latest continuation

`003c335` maintenance attachment feature is pushed and deployed to DEV. Local API/domain/browser/PostgreSQL coverage, typecheck/lint and isolated migration rollback passed. Backup encryption/checksum/retention/monitoring/restore and public DEV smoke also passed. Continue implementation backlog before UAT; prioritize verifiable code gaps (financial reporting/workflows, remaining P1 lifecycle and P6 accessibility) and reconcile outdated phase checkboxes before claiming completion. Keep LINE observer-only and outbound disabled; do not treat same-VPS backup as host-loss DR.

### Latest VPS follow-up

Branch `main` is pushed through `57706b1`; only a Playwright locator changed and PostgreSQL browser workflows passed 24/24. Rebuild succeeded, but the deploy script failed its public HTTPS check and safely rolled back app images to `003c335` (API/Web/observer healthy; DB untouched). DNS resolves but no host proxy/Nginx/80/443 listener was found. Diagnose/restore the authorized proxy/ACME route before retry; do not restart shared Traefik blindly. LINE access token is valid and current webhook URL matches DEV; no active org/OA binding exists, so keep outbound disabled/worker observe until an owner org is provisioned and admin binding/consent gates pass.

### 2026-11-05 latest recovery

The Dokploy Traefik container had exited after reboot with a missing network reference. Verified ACME JSON was valid, protected (`0600`) and read-write persistent, then started the existing proxy container; Apartment HTTPS ingress recovered. Built/deployed `41e9a7b`; backup/restore, migration/observer safety, public Web/API health/readiness and unsigned webhook denial all pass. API/Web/observer healthy; PostgreSQL not restarted. Traefik still logs invalid PEMs for unrelated configured hostnames; do not alter those project certs here. LINE token/webhook are configured and validated, but DEV has no active organization or OA binding; keep outbound disabled/observe until owner onboarding and consent gates are completed.
