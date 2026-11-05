# Apartment implementation status — 2026-11-03

## 2026-11-05 privacy release candidate — QA PASS, deploy pending

- P5-PRIVACY-01 / P6-PRIVACY-01: request, cancel, trusted platform-admin review, and responsive own-profile UI implemented. Additive migration 0020 and metadata validated on isolated PostgreSQL; not yet applied to DEV.
- P5-PRIVACY-02 / P2-PRIVACY-RACE-01: profile-only guard and anonymization pass synthetic isolated smoke; invitation approval serializes with account disable and requires active OWNER. Actual profile execution remains disabled by default. No live account was erased.
- Final DEV automated gates PASS: unit271/271 across51 files; domain15/15 with100% lines; API unit-only coverage not remeasured after new report files; PostgreSQL HTTP c8 87.41% (5937/6792) across all70 API source files; mocked browser33/33; real PostgreSQL/browser workflows24/24 across Desktop,390px,320px; Manager owner-action visibility regression PASS; migration0020 rehearsal preserved/restored36 original table fingerprints.
- Lint and TypeScript PASS, Drizzle check PASS, high/critical audit gate PASS (six moderate advisories documented), disposable backup/restore/predeploy checks are current. Latest: commit 0048b98 is pushed and DEV deployed; backup/restore and public HTTPS smoke PASS. Fresh LINE user login remains to be verified.
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


`docs/PHASES.md` is the canonical plan and handoff. This file is a short mirror; do not maintain a second checklist here.

## Current state

- DEV implementation through P5 maintenance tickets and room maintenance transitions is deployed in the existing Dokploy Compose project; migration 0016 is applied.
- P1-05 input/storage bounds and PostgreSQL HTTP concurrency gates pass. The 76-request isolated DEV smoke passed negative/fraction/overflow, duplicate meter, cross-org denial, 16-way same-key replay, 16-way distinct-key race and 32-way preview burst; p95 was 395/282/275 ms; a separated 64-way preview burst also returned 64/64 HTTP 200 (p95 608 ms). A separate 2026-11-03 Independent QA script tested 16 duplicate meter writes (1 success, 15 conflicts), 48 concurrent scoped reads, 5/5 post-revocation write denials, revoked session/disabled account, with overall p95 381 ms; API 76/76 unit tests and typecheck passed. See `docs/P1_P105_INDEPENDENT_QA.md`. Keep P1-05 open for longer monitored soak, threat-model review, coverage/CI and final external security/load acceptance.
- P5 maintenance PostgreSQL/HTTP smoke passes owner/tenant scope, approved lease binding, history visibility, ordered transitions, audit and return-from-maintenance gate.
- Unit tests: domain 11/11 and API 76/76; monorepo typecheck and Web production build pass. Backup `apartment-20261103T153805Z-25493.dump` SHA verification and isolated restore test passed before rollout. Migration 0016 applied; database has 31 public base tables.
- **November 4 DEV Recovery:** Apartment-only API/Web/LINE Observer were rebuilt from clean committed Git `113c329` after checksum-verified backup and are Healthy; public Web remains on private 127.0.0.1:18089 with HTTP 200, /readyz 200 and unauthenticated management 401. Worker remains observe-only (`LINE_WORKER_APPROVED=false`, outbound disabled), dispatched=0. The public HTTPS endpoint is DOWN because the shared Traefik container is absent; no other services were touched.
- **Public TLS is currently unavailable** (port 443 connection failed) and durable shared Traefik ACME persistence/renewal requires an authorized multi-service recovery plan; do not restart or recreate shared proxy from an Apartment feature session. Full external readiness still requires LINE/LIFF, bank-app QR recipient confirmation, live S3/ClamAV controls, legal/tax review, offsite backup, independent security/load review and Production acceptance.

## Completed implementation

P0 foundation; P1-01a move-out, P1-02 effective-dated property rates, P1-03a/b room rates and partial billing, P1-03c meter replacement and partial move-out, P1-04 property staff access; P2 invite/claim/approval portal; P3 DEV payment claims, ledger, financial review, PromptPay QR builder, private/S3-mock evidence workflow and non-tax Billing Notice PDF; P4 signed webhook/outbox, tenant consent, observe-only operations, quotas, alerts and reservation retention.

These are DEV implementations. Their provider, legal, financial, reliability, load, or Production gates remain open where listed in `docs/PHASES.md`.

## P7-02 CI groundwork (2026-11-04)
- [x] New `.github/workflows/ci.yml` with read-only GitHub permission, PR-scoped concurrency, Node 24, pinned Corepack + pnpm from lockfile, Drizzle snapshot validation, monorepo unit/typecheck/Web build and disposable PostgreSQL 16 migration + tenant/staff/invoice/payment/maintenance/LINE/S3-mock HTTP smoke. See `docs/P7_CI_RUNBOOK.md`.
- [x] Locally YAML parsed and environment fail-closed guards verified, API 76/76 unit tests, domain unit tests, TypeScript and Web production build PASS; `drizzle-kit check` PASS.
- [x] GitHub Actions run `41750529389` at commit `c908f1c`: both quality and clean-PostgreSQL integration/security jobs passed on hosted runners. CI toolchain fixes: Corepack 0.36.0 for pnpm 12 and dummy test ENV in quality job.
- [x] ESLint 0 errors / 37 warnings, Vitest V8 measured API 29.28% lines and Domain 100% lines (96.42% branches after 4 new test cases). Dependency audit after workspace security overrides: 0 Critical / 0 High, 6 Moderate. See `docs/P7_DEPENDENCY_AUDIT.md`.
- [x] Updated GitHub Actions Run `41751709175`, commit `f9c9e54`, passed 2/2 hosted jobs after security overrides and lint/coverage/audit additions.
- [ ] API Coverage 80%, warnings/Moderate remediation, browser Playwright, and branch-protection Required Checks remain pending.
- [ ] Concurrent P5 Bulk Billing uncommitted schema adds `invoices.billing_batch_run_id`; direct HTTP smoke against DEV migration 0016 responded 500 due missing column. This is schema drift from separate WIP (0017 not applied), NOT a deployed P1-05 regression. Do not apply pending migration or alter P5 working files from this CI session.

## November 4, 2026 — phase audit, P1-05 soak and CI toolchain
- Prior phases P0–P5 remain partial where real provider, legal, refund, deposit, security and browser acceptance gates are pending. Full block-by-block status: `docs/PHASE_COMPLETION_AUDIT.md`.
- Independent authorization soak on an isolated API + disposable DEV synthetic data completed for 60 seconds at nominal 1 RPS: 60/60 expected HTTP statuses (40 allowed / 20 denied), 0 unexpected, p95 14 ms, p99 36 ms, isolated API RSS sample 236 MB stable, observed max DB connections 4. `docs/P1_P105_SOAK.md`. Not a production load signoff.
- GitHub Actions `3432db1` failed before tests: Corepack 0.34.2 expects a legacy `pnpm.cjs` that pnpm 12.16.1 does not ship. Workflow upgraded to Corepack 0.36.0 and pushed as `a071448`; follow-up remote run still requires verification. No DEV service or shared proxy was restarted.

## November 4, 2026 — P7-02 lint cleanup (independent of Bulk Billing)
- ESLint warnings reduced from 37 to 5 (0 errors) by removing unused imports/bindings, preserving evidence field omission and security validation. All 76 API unit tests, monorepo TypeScript typecheck and Web production build passed. Remaining warnings in concurrently edited `apps/api/src/index.ts`, `apps/api/src/routes/billing-batches.ts`, and `apps/web/src/main.tsx` were deliberately left untouched.
- Strict zero-warning CI gate, API >=80% coverage, Playwright browser E2E and branch protections remain pending. No WIP migration was applied or DEV services restarted.

## November 4, 2026 — P7-03 security isolation expansion
- Extended isolated API/PostgreSQL independent smoke to verify disabled property grants, disabled staff memberships, disabled organization and disabled user session access; the synthetic fixtures are restored between cases and cleaned afterward. All added deny/re-enable assertions passed; cross-org and revoked-session cases still pass. Original P1-05 48-concurrent-read and 16-duplicate-meter checks preserved. Rate-limit window separation is enforced rather than bypassing the 90/minute guard.
- Current database enum has only ACTIVE/DISABLED, not SUSPENDED. P7-03 is **partial** until suspended/missing/lease cases and independent security acceptance. No WIP migration touched; no DEV deployment.

## November 4, 2026 — P7-03 tenant invoice and lease IDOR gates
- Extended existing isolated loopback / synthetic PostgreSQL smoke: two separate tenant subjects, two organizations and two invoices; tests own invoice list/detail, bidirectional cross-tenant IDOR 404, missing invoice 404, unlinked tenant zero visible invoices, closed lease suppression of list/detail and disabled org suppression, with restored access after re-enable. PASS, and original 48-read burst/16 duplicate meter gates still PASS. Fixtures cleaned by ID in FK order.
- The live DEV database lacks concurrent Bulk Billing migration-0017 `billing_batch_run_id`; test fixtures intentionally INSERT only migration-0016 columns using parameterized SQL. No schema migration or deploy performed. P0-P7 remain partially open where provider, legal, policy, UAT and production readiness gates are incomplete.

## November 4, 2026 — P0 predecessor gate verification and schema drift detection
- Ran root-only backup `verify` + disposable network-isolated `restore-test`: checksum PASS; all 31 public tables restored. This is not a downgrade/rollback or offsite DR signoff.
- Added read-only `apps/api/scripts/check-db-schema-compatibility.ts` comparing current Drizzle table columns with PostgreSQL information_schema and a 4-case unit test. Preflight deliberately exits nonzero for 17 missing columns: 16 in uncommitted Bulk Billing `billing_batch_runs`, 1 `invoices.billing_batch_run_id`. No schema modification, migration, deploy or external calls.
- API 80/80 tests and TypeScript typecheck PASS. P0 remains PARTIAL for 80% meaningful coverage, irreversible migration rollback proof, required checks and offsite recovery. Coordinate migration-0017 with concurrent session before retesting preflight.

## November 4, 2026 — P0 CI schema gate continuation
- Added read-only Schema Compatibility Preflight to `.github/workflows/ci.yml` `postgres-security` job after clean disposable PostgreSQL migrations and before integration/security HTTP suites. YAML loads, gate ordering verified, schema preflight unit tests 4/4 pass and API typecheck pass. No DEV database migration performed and no remote CI success claimed for this uncommitted change.
- The current DEV schema still differs from concurrent uncommitted Drizzle migration-0017 by 17 columns; pending migration coordination remains the blocker. P0 remains PARTIAL: >=80% API coverage, branch protection, migration rollback proof and offsite recovery still open.

## November 4, 2026 — disposable P0 migration/preflight dry-run
- Isolated Docker postgres:16-alpine, loopback random port, synthetic credentials, clean Drizzle migration through current uncommitted 0017: PASS. Read-only column compatibility check: PASS, 335 columns, zero missing. Disposable DB container automatically removed; **DEV DB remains at 0016**, without applying WIP 0017. Migration rollback, data upgrade, remote CI, branch protection, 80% coverage, offsite restore remain open.
- Measured API V8 coverage: 29.34% lines (1410/4805), 81.87% branches, 67.97% functions; does not meet meaningful 80% line target.

## November 4, 2026 — P0 migration 0017 seeded-data upgrade rehearsal
- Took latest local root-only Apartment backup already on disk (without modifying source), restored into disposable PostgreSQL 16 Docker `--network none` (no host ports), then applied pending SQL migration 0017 via `psql -X -v ON_ERROR_STOP=1`. PASS: public base tables 31→32, `invoices.billing_batch_run_id` present, counts digest for organizations/users/leases/invoices/invoice_lines unchanged. Test container removed via shell EXIT trap; no actual DEV DB mutation.
- **Limitations:** Counts digest does not prove row-byte integrity, application compatibility, billing invariants, down-migration safety, rollback or offsite DR. The concurrently edited Bulk Billing code/migration must still be reconciled before DEV rollout. P0 remains PARTIAL and cannot be marked done.

## November 4, 2026 — isolated backup-based recovery drill
- In a disposable `--network none` PostgreSQL 16 Docker container, restored a protected pre-upgrade backup to database A, computed content digests across five key tables, applied migration 0017 on A, then confirmed original-column content digests unchanged. Restored same backup to a separate empty database B and verified digest identical to baseline and invoice batch column absent. PASS; temporary container removed, no DEV database mutations. First attempt to restore over a nonempty schema correctly failed due to existing Drizzle metadata; the successful test used an independent empty database.
- This is a backup-based point-in-time recovery rehearsal, not in-place downgrade, preservation of writes after the backup, offsite DR or Production acceptance. P0 remains PARTIAL for coverage, CI branch enforcement and remaining recovery guarantees.

## November 4, 2026 — P0 backup-based recovery drill
- Added and executed `infra/rehearse-apartment-migration-rollback.sh`: verified newest local archive SHA-256, restored it to temporary networkless tmpfs PostgreSQL, applied migration 0017, then restored original archive to isolated database; original row-content fingerprints matched across organizations/users/leases/invoices/invoice_lines and newly added 0017 table/column were absent again. PASS. Container auto-cleaned; no DEV migration or deploy.
- This proves backup-point recovery only. In-place downgrade with writes after backup, offsite backups, branch protection and API coverage >=80% remain open. P0 not fully closed.

## November 4, 2026 — P0 seeded-data upgrade/recovery hardening
- Hardened isolated recovery drill with a synthetic organization sentinel after restoring the original backup. Five full-row table fingerprints remain unchanged across isolated migration 0017; recovery then matches the original backup and removes the sentinel. PASS, no DEV writes or deploy. Branch-protection endpoint read returned GitHub 403 (integration lacks admin), repo rulesets list empty; gh CLI absent on VPS. API line coverage remains 29.34%, far below >=80%; P0 not fully complete.

## November 4, 2026 — P0/P7 measurable CI coverage quality gate
- Replaced informational-only CI coverage output with enforced Vitest line thresholds: Domain 80% minimum (actual 100%), API temporary no-regression floor 29% (actual 29.34%). Both thresholded suites PASS on VPS. This does **not** satisfy required 80% meaningful API coverage; suite must be expanded and threshold raised as coverage improves. No WIP migration or DEV service touched.

## November 4, 2026 — Due-reminder safety tests and API coverage
- Added 8 targeted unit tests for `prepareDueReminders`: dry-run without writes, Bangkok-local date restriction, outstanding/pending claim/locked invoice checks, idempotent notifications, and bounded input limit. RED test exposed that `NaN`, `Infinity`, and fractional limit values reached database query; validated `z.number().finite().int()` prior to clamping. Target tests 8/8 PASS, API line coverage increased 29.34% to 30.19% (1451/4805). CI regression floor moved to 30%; 80% target is still open. No DEV DB migration or live notification sends.

## November 4, 2026 — P0 financial-position tests and coverage
- Added `apps/api/tests/financial-position.test.ts` with 7 isolated service tests covering ledger aggregation, reversal/credit calculation, fully settled invoices, 404 for unknown invoice, and fail-closed 409 for inconsistent ledger / invalid money; ignored adjustment kinds do not alter balance. 7/7 targeted PASS. API V8 line coverage 30.19%→30.55% (1468/4805). API >=80% remains OPEN; no real payment/deploy/migration.

## November 4, 2026 — P0–P7 predecessor review, P1-01 security tests
- Reviewed all P0–P7 unchecked Phase rows. P0 (API ≥80%, branch rules, offsite DR), P1 (deposit/refund/legal, browser UAT, final performance acceptance), P2–P4 (live LINE/S3/bank provider acceptance), P5 (concurrent WIP 0017 and remaining operations), P6 (Figma design), P7 (independent QA/security/legal/performance) remain NOT COMPLETE.
- Added seven P1-01 move-out denial tests before any DB write: no property, no OWNER membership, missing/wrong scope lease, ended lease, unoccupied room, missing boundary water or electricity. 7/7 targeted PASS; API line coverage increased 30.55%→31.15% (1497/4805). CI temporary floor 30%→31% (not final 80% goal). No shared DEV migration, no external sends and no concurrent WIP files changed.

## November 4, 2026 — P1 move-out authorization and financial settlement gate tests
- Expanded isolated transaction tests in `apps/api/tests/lease-move-out-authorization.test.ts` from 7 to 12, covering missing final-period invoice, future-dated invoices, pending payment claims, pending finance adjustments and unsettled balance. All cases reject before any mocked DB update/insert. Targeted 12/12 PASS, API V8 lines 31.65% (1521/4805), still below 80%. No DEV database writes, migration or LINE sends. P0–P7 acceptance gates remain open; do not mark P1 complete.

## November 4, 2026 — P4 LINE fairness regression repair
- Re-audited P0–P7. Found P4 line outbox fairness bug: `null` oldest queue age was sorted as epoch zero, giving unknown-age queue priority over verified older waiting jobs at equal usage. Added failing regression (RED), changed `rankOrgQueues` to place null age after measured ages, then GREEN targeted 3/3. API V8 line coverage 31.66% (1522/4806), far below 80%; pending Provider/UAT/CI completion remains open. No live LINE traffic or migration.

## November 4, 2026 — ordered P0 coding: encrypted offsite backup and retrieve
- Added `infra/offsite-apartment-postgres.sh` and `infra/retrieve-offsite-apartment-postgres.sh` with root-only file permissions, strict age recipient/destination validation, verified local SHA-256, ciphertext-only immutable upload, remote ciphertext digest readback, authenticated decryption and safe archive retrieval (no live DB restore). Added eight shell preflight/denial checks; 8/8 PASS without transfers. Added repository-only opt-in systemd offsite shipper service and Bangkok 04:30 timer; calendar/unit syntax verified, neither installed nor enabled. Runbook `docs/OFFSITE_BACKUP.md` documents deferred environment and separate recovery identity.
- **Not executed:** actual offsite upload or remote retrieval; age/rclone missing and operator has not configured an offsite destination. P0 remains PARTIAL for live DR acceptance, >=80% API line coverage, branch rules. LINE channel/LIFF ENV intentionally deferred per user.

## November 4, 2026 — P0 offsite uploader mock end-to-end coding gate
- Added `infra/tests/offsite-upload-mock.test.sh`: root-only, isolated fake `age` and `rclone`, reads existing verified backup without mutation, validates the upload flow's ciphertext-before-transfer contract, immutable object rejection, detection of corrupted remote readback, simulated encryption failure and simulated upload failure (all fail closed). `OFFSITE_UPLOAD_MOCK_PASS` with no network calls. Added shell syntax validation to GitHub CI. This verifies orchestration logic, not actual age cryptography or cloud provider interop. Still requires real remote/credentials/recovery drill; P0 not accepted.

## November 4, 2026 — P1 deposit policy and former-tenant history full-stack coding increment
- Added `apps/api/src/services/deposit-settlement.ts` with a strictly preview-only, integer-satang deposit balance and reserve policy. Seven unit tests PASS, including refund/deduction/dispute caps and no automatic rent offset or cash payout. **Persisted deposit ledger, review state, actual refund API/UI are NOT implemented** because shared schema migration 0017 is owned by a concurrent session; finance policy and legal approval remain outstanding.
- Added fail-closed `former-tenant-access.ts` and registered new read-only endpoints `/v1/tenant/history/invoices` and `/:invoiceId` in `former-tenant-history.ts`. They require verified active LINE-linked account, org/property scope, ENDED lease, ISSUED invoice within original lease boundaries, and no-store. Added history section to `TenantPortal.tsx` with historical detail and **no payment/claim actions**. Seven policy and six Fastify HTTP injection tests PASS. Real browser and provider E2E still pending.
- API V8 lines increased from 31.66% to 33.50% (1656/4942); CI temporary floor raised to 33%. Target ≥80% still NOT satisfied. No LINE ENV set, no database migration, deploy, push, or commit.

## November 4, 2026 — P2–P6 sequential coding continuation
- P2: added 8 Fastify HTTP injection tests using mock identity/transactions for invitation claim, no direct bill access, replay/revoke/expiry, lease/account invalid state, lost CAS race and explicit owner approval. No LINE ENV or network calls.
- P3: implemented owner-scoped `/v1/properties/:propertyId/receivables.csv` with repeatable-read accounting snapshot, 500-row fail-closed limit, no-store download and PII-free safe UUID/date/integer-satang CSV serializer. 5 serializer tests plus 5 HTTP injection tests PASS; this is DEV export code, not bank/tax/legal acceptance.
- P5: implemented read-only scoped meter-anomaly preview GET endpoint and advisory policy: physical replacements/resets/duplicate period/usage spikes require review; 6 policy tests and 6 Fastify HTTP injection tests PASS. Does not mutate meter records or invoices; evidence/threshold configuration/persistent review still open.
- P6: added high-contrast keyboard focus-visible ring and prefers-reduced-motion CSS; web build PASS. Figma and independent WCAG/visual UAT still unverified.
- API V8 lines now 37.08% (1892/5102); temporary CI floor raised to 37%, final >=80% still OPEN. Preserved concurrent 0017 WIP; no shared DEV migration, provider sends, commit/push, or deploy.

## November 4, 2026 — subsequent P1 and P5 full-stack coding gates
- **P1 mid-cycle lease transitions:** added `lease-billing-segments.ts` pure canonical billing cycle clipping and owner-scoped, no-write GET `/v1/properties/:propertyId/leases/:leaseId/billing-segments`. Covers monthly, semi-monthly and anchored 15-day cycles, partial first/last segments, missing anchors, invalid dates, oversize periods and tenant/property scope. 5 domain + 6 Fastify HTTP tests PASS. Does not create monetary adjustments or issue invoices.
- **P5 privacy:** added subject-bound rate-limited GET `/v1/tenant/privacy/export` and Tenant Portal download link. Exports only verified active user's own ACTIVE/ENDED leases and issued invoices after org/property/date filtering, no-store, 100 lease / 500 invoice caps and no provider tokens. Seven Fastify HTTP tests PASS. Legal retention/deletion and all documents/evidence portability still OPEN.
- **P5 occupancy:** added owner dashboard `PropertyOperationsReports.tsx` with occupancy/reconciliation warning, CSV download and loading/error states, mounted on overview only for non-STAFF; TypeScript and Web build PASS. Added strict `requirePropertyAdministrator` guard for occupancy and mid-cycle preview, blocking STAFF unless active OWNER/MANAGER membership; 4 security tests PASS.
- **P5 occupancy:** added scoped GET `/v1/properties/:propertyId/occupancy-report` and pure occupancy reconciliation (room states vs active leases), under repeatable-read, bounded no-truncation limits. 5 domain + 5 HTTP injection tests PASS; no tenant PII. Full revenue analytics remain OPEN.
- API V8 lines 39.68% (2117/5335), temporary CI no-regression floor raised to 39%. Still below final >=80% threshold. All changed APIs are DEV code; real database and independent browser E2E not yet demonstrated for these new routes. Concurrent migration 0017 untouched; LINE ENV still deferred.

## November 4, 2026 — P4 no-send LINE outbox observer service
- Added `infra/systemd/apartment-line-outbox-observer.service` for continuous worker process with forced observe-only safety switches, conditioned on root-only `/etc/apartment/line-worker.env`; it requires no LINE channel credentials to observe queue health, but still needs DB configuration. Added GitHub CI static guard against accidental live send and verified systemd syntax locally. No unit installation, activation, LINE API calls or service changes. Live outbound mode requires separate reviewed rollout after operator-provided credentials and provider acceptance.

## Next work

1. Run a larger bounded load profile and independent security/load acceptance for P1-05.
2. Continue deposits, settlement, bulk billing and tenant operations; P5 maintenance workflow is deployed and smoke-verified.
3. Keep LINE/LIFF, bank, S3/ClamAV, legal/tax, offsite backup and Production acceptance open until their required credentials, decisions and external verification exist.

Never treat a manual payment approval as bank-verified funds, issue an official receipt/tax invoice without legal approval, or enable live LINE sending from the DEV observer.

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

## 2026-11-05 continuation update

Latest DEV commit: `003c335f330d63cdf851cf2f70f22c2f113efbb1` (maintenance private attachments). Build/deploy completed; encrypted local pre-deploy backup and isolated restore passed; migrations/observer safety and public web/API readiness smoke passed. Attachment browser workflow passed at desktop, 390px and 320px. Code completion remains in progress; do not infer full phase/UAT/production readiness from this deployment.

## Deployment and LINE configuration follow-up — 2026-11-05

Commit `57706b1` (test selector only) is pushed. Its DEV deploy attempt was rolled back by the deployment script after public TCP/443 failed; runtime revision remains `003c335` and API/Web/observer are healthy. No local proxy or Nginx listener was running, so public HTTPS smoke remains blocked. LINE credentials are present and validated with a read-only Bot Info request; the LINE Console webhook is configured to the Apartment DEV callback. No active organization/OA binding exists; outbound LINE remains safely disabled.

## Latest recovery and deployment — 2026-11-05

Started the existing Dokploy Traefik container after verifying its persistent ACME JSON was valid and mounted read-write; Apartment public HTTPS returned. Commit `41e9a7b` deployed successfully after encrypted backup/isolated restore and migration/observer safety checks. Public smoke: Web/API health/readiness 200, unsigned LINE webhook 401. Runtime API/Web/observer healthy; PostgreSQL not restarted. Runtime LINE secrets are protected; Bot Info and webhook URL checks passed. No active DEV organization/OA binding exists, so outbound remains disabled and LINE tenant messaging is not yet ready for UAT.

A synthetic HMAC-signed empty LINE webhook passed through public HTTPS/signature parsing but returned `LINE_OA_BINDING_NOT_ENABLED`, confirming no enabled organization binding is present. No message was sent.

## 2026-11-05 session update — P5 financial reporting and LINE login diagnostics

- Task `P5-FINREP-01`: DONE (implementation + targeted verification). Added owner/SUPER_ADMIN-scoped read-only `GET /v1/properties/:propertyId/financial-report`, bounded date range and row count, repeatable-read snapshot, integer-satang totals, posted-ledger-only calculations, no-store response, and explicit `bankVerified:false`. Added occupancy/financial summary to the owner reports UI. No bank settlement is inferred.
- Task `P2-LINE-DIAG-01`: DONE (safe diagnostic logging added; provider cause remains pending a fresh user login after deployment). Existing `INVALID_LINE_TOKEN` is raised when LINE `/oauth2/v2.1/verify` responds non-2xx. Live frontend LIFF ID prefix and API LINE Login channel were checked and match; current code did not retain the provider error code. New API warning logs only provider HTTP status and error identifier, never token/body/secret. LINE outbound remains disabled.
- Files changed: `apps/api/src/services/property-financial-summary.ts`, `apps/api/src/routes/property-financial-report.ts`, `apps/api/tests/property-financial-summary.test.ts`, `apps/api/tests/property-financial-report-http.test.ts`, `apps/api/src/index.ts`, `apps/api/scripts/smoke-http.ts`, `apps/web/src/components/PropertyOperationsReports.tsx`, `tests/e2e/portal.spec.ts`, `infra/test-api-postgres-coverage.sh`.
- Verification: API 271/271; domain 15/15; Playwright 33/33 (desktop, 390px, 320px), including owner financial-report UI; targeted report tests 8/8; focused isolated-PostgreSQL HTTP smoke PASS; full isolated-PostgreSQL API line coverage 87.41% (5,937/6,792); typecheck, ESLint zero warnings, `git diff --check` PASS.
- Deployment status: DEV deployment completed; see the following deployment verification section for backup and public smoke evidence. Production untouched. External LINE user/device login verification remains pending.
- This slice does not close the remaining P0–P7/provider/UAT tasks and is not a 100% DEV READY claim.

## 2026-11-05 deployment verification — commit 0048b98

- Commit `0048b98` pushed to `origin/main` and deployed through the existing Apartment Dokploy project. Runtime image revision verified as `0048b987ee5b12ea094345e0a6b68baac14a20ad`; API, observer and Web healthy; PostgreSQL was not restarted.
- Pre-deploy evidence: checksum-verified backup `apartment-20261105T130102Z-60831.dump`; same-VPS age encryption, retention and monitoring PASS; isolated restore PASS for 38 public tables.
- DEV smoke: public Web, `/healthz`, `/readyz` = 200; unsigned LINE webhook = 401; certificates verified; no live LINE calls.
- LINE login diagnostic: provider rejection handling was exercised only with a synthetic invalid token and logged `providerStatus=400`, `providerError=invalid_request`; no token or secret appeared in the warning. This is not evidence for the user's real login attempt. The LIFF/API channel prefix matches; prior real attempts predated this diagnostic and cannot be attributed more specifically. Re-test from LINE after deployment to read the sanitized provider reason.
- External LINE user/device login acceptance remains pending. LINE outbound remains disabled; production untouched.
