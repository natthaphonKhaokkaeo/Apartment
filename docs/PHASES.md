# Apartment SaaS — Master Phase Plan & Session Handoff




## 2026-11-05 room-level default/override rates (QA PASS; DEV deployed)

- P1/P6-ROOM-RATES: the new-room form now displays the property's rent, water and electricity rates as selected defaults with disabled amount inputs. Clearing an individual default checkbox enables that room's amount field. Mixed default/override values are supported.
- Room creation sends explicit integer satang overrides, and sends `null` for each rate left on the property's default. This uses the existing nullable room rate fields; no schema migration is needed. Existing effective-dated rate changes remain available for later adjustments.
- Property creation and property-rate settings now label rent, water and electricity as property defaults that may be overridden per room.
- Verification: Playwright property/room workflow passes on desktop and mobile 390px/320px; E2E 36/36; API 285/285; domain 15/15; TypeScript and ESLint pass. The browser test verifies 4,500 THB rent and 5.25 THB electricity become 450,000 and 525 satang, while default water remains `null`.
- DEV evidence: `DEV_DEPLOY_PASS` commit `6066f4bbb6e0`; backup encryption/checksum/retention/monitoring/restore drill pass; migrations and public HTTPS smoke pass; PostgreSQL not restarted.

## 2026-11-05 platform admin management + Super Admin LINE Rich Menu (DEV deployed and provider-provisioned)

- P0/P2/P6-PLATFORM-ADMIN: added authenticated platform-user search and role-change API plus responsive Super Admin UI. Role changes are audited, revoke active sessions, require active LINE-verified accounts, and serialize demotions to protect the last active Super Admin. Bootstrap admin and self-demotion are protected.
- P2/P6-LINE-SUPERADMIN-MENU: role classification now reads the persisted server-side `platformRole`; Super Admin has a distinct admin Rich Menu with `/` `?section=admin` destination. Owner, tenant, public, and account templates remain separate.
- Automated evidence: API 285/285 across 54 files; domain 15/15; Playwright E2E 36/36 (desktop, mobile 390px and 320px); workspace TypeScript and ESLint pass with zero warnings. API mocked-provider tests are not real second-account LINE UAT.
- Live LINE evidence from the currently deployed release: public default menu is confirmed through `GET /v2/bot/user/all/richmenu`; four pre-existing templates are provisioned. All five templates are confirmed in the LINE channel; the public menu is verified as the default. Super Admin role-to-menu linking takes effect on the account’s next verified LIFF login.
- Login observation: the application implements LIFF login, not username/password credentials. When LINE opens its hosted account sign-in form for a second account, that page is LINE authentication. The reported second-account callback has not been observed in API logs and remains pending real-account UAT.
- DEV deploy evidence: `8051a4b` healthy; `DEV_DEPLOY_PASS`; PostgreSQL backup/checksum/encryption/restore drill pass; migration journal pass; HTTPS web/API/ready and webhook-denial smoke pass; PostgreSQL was not restarted.
- LINE provisioning evidence: `LINE_RICH_MENU_PROVISION_PASS roles=public,owner,tenant,account,superadmin`; provider verification confirms all five templates and public default.
- No external LINE outbound messaging is enabled. Real second-account callback and per-user visual UAT still require a real user to complete a LINE login and inspect OA chat.

## 2026-11-05 LINE login continuation + per-user Rich Menu (implementation verified, deployment pending)

- P2-LINE-POSTLOGIN: successful LIFF ID-token exchange now requires `/v1/me` to load and presents an explicit error if session bootstrap fails; it routes verified workspace members to overview, active lease users to tenant self-service, and unassigned accounts to onboarding overview. Rich-menu deep links preserve the requested section.
- P4-LINE-RICHMENU: four versioned rich-menu templates (public, owner, tenant, account) and 2500×1686 Thai PNG artwork implemented. Authenticated server-side roles select per-user menus after LINE token verification; logout unlinks the user menu. Provisioning only calls Rich Menu APIs and never sends messages.
- Added protected SUPER_ADMIN provisioning endpoint and root-only `infra/provision-line-rich-menus.sh`; LINE credentials stay in runtime env. OA public default is the guest/login menu; per-user assignment has higher display priority.
- Verification on current tree: TypeScript PASS; changed-file ESLint PASS (zero warnings); API/domain test command PASS (277 API + 15 domain); Playwright mocked browser 33/33 PASS across desktop/390px/320px, including owner profile/logout and tenant flows; web production build PASS (existing >500KB chunk advisory). Rich-menu PNG signature/dimensions/size and provider-call/idempotence unit tests PASS. No database migration needed.
- Actual LINE API provisioning and DEV rollout are still pending in this status entry; actual user menu appearance requires the user's next verified login while they are a friend of the OA. Provider login/browser UAT has not been observed. This feature increment does not complete P0–P7 or authorize live outbound messages/production.

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


> **Source of truth:** this file is canonical. Update checkboxes **only after code + evidence**.
> Repo: `/root/Projects/Apartment` | Branch: `main` | Last baseline commit: `1c785e1` (2026-11-03).
> Environment: DEV ONLY; no production launch, real payment, or outbound LINE messages without authorization.

## Status legend

- `[x]` implemented **and verified** (refer to evidence)
- `[ ]` pending, partial, blocked, or unverified; add `IN PROGRESS` / `BLOCKED` label as needed
- Never mark whole phase DONE while a blocking checklist item remains.
- Always update **Current checkpoint**, **Verification evidence**, and **NEXT SESSION START HERE** before ending a coding session.

## Current checkpoint (live)

- **2026-11-05 new independent DEV implementation:** 27/27 Playwright Browser E2E (Desktop, 390px and 320px Mobile) PASS with mocked API; Sidebar Logout scroll/viewport regression fixed; package and CI browser gates added. Disposable PostgreSQL regression pack (owner/staff/tenant authorization, concurrent payments/finance, maintenance, Bulk Billing approval replay, LINE webhook/consent, S3/evidence mock) PASS. Real age/rclone encryption and decryption using **local temporary destination** PASS; independently stored offsite DR **not yet accepted**. Root lint now enforces zero warnings. Full API line coverage still **40.38%**, below 80%, and real LINE UAT/S3/Bank/Security signoff remain OPEN. See `docs/IMPLEMENTATION-MASTER-STATUS.md`, `docs/P7_BROWSER_E2E_RUNBOOK.md`. No push/deploy of shared WIP.


- **2026-11-04 late independent audit:** `docs/IMPLEMENTATION-MASTER-STATUS.md` tracks 96 Phase task identifiers and verifies latest `pnpm test` 15 Domain + 200 API tests PASS; typecheck PASS; lint **0 errors/0 warnings** after targeted cleanup; web build PASS; API meaningful line coverage **40.38% < 80%** (release gate OPEN); read-only DB preflight 335 columns PASS; DEV DB 18 migrations/32 public tables; public TLS + unsigned LINE webhook-denial smoke PASS. Networkless checksum-verified backup/migration 0017 recovery PASS. Installed `age`/`rclone` prereqs, but approved offsite destination, recovery key, real restore, browser E2E, LINE sandbox, financial and UAT signoff remain OPEN. **No commit/push/deploy during this audit; preserve pre-existing uncommitted code and observer-only LINE mode.**

- **Current phase:** P1-05 independent DEV security/load verification is IN PROGRESS, with additional 60-second controlled permission-soak PASS on 2026-11-04; real load/UAT/coverage gate still OPEN. P1-04 staff access and P1-01b/P5 maintenance are DEV-implemented, but the prior phases are NOT fully complete. See `docs/PHASE_COMPLETION_AUDIT.md` for provider/legal/QA blockers and never count them as Done.
- **Immediate task:** P1-05 final longer monitored soak, independent security/load acceptance and P7-02 CI rollout verification. P7-02 GitHub-hosted CI quality + clean PostgreSQL integration verified PASS 2/2, latest Run `41752517992` (`113c329`); P1-05 (`c0dedbc`) and maintenance (`4f400b2`) remain DEV-deployed. P5 Bulk Billing has concurrent uncommitted implementation in the shared tree and MUST NOT be reset, staged, migrated or deployed from this CI work. Keep LINE outbound disabled; deposit workflows and LINE Login/LIFF remain gated on policy/provider acceptance.
- **Last verified (2026-11-04):** 91 unit tests (15 Domain + 76 API), TypeScript and Web build PASS; P1-05 isolated 60-second 1-RPS STAFF scope soak PASS (60/60, p95 14 ms, sampled RSS 236 MB), API Vitest unit line coverage 29.28%, Domain line/branch coverage 100%/96.42%, ESLint 0 errors / 37 warnings, pnpm audit 0 Critical/High (6 Moderate). GitHub Actions Run `41752517992` (commit `113c329`) passed quality and disposable PostgreSQL integration/security jobs 2/2 using patched dependencies. Migration 0016 verified for deployed DEV; uncommitted P5 migration 0017 is NOT applied by this QA session. LINE outbound remains disabled. Earlier P1-05 concurrency/restore evidence is retained in `docs/DEPLOY_DOKPLOY_DEV.md` and `docs/P1_P105_INDEPENDENT_QA.md`.
- **Deployment (2026-11-04):** Apartment-only API/Web/observe-only Worker and PostgreSQL are healthy in DEV. Missing Web Container was rebuilt from committed Git `113c329` and restored on loopback 127.0.0.1:18089; API + Observer updated to security-patched images after Apartment-only checksum-verified backup. Local homepage and /readyz return 200; anonymous API returns 401; Worker dispatched=0 and external LINE sending disabled. **Public HTTPS currently DOWN** (443 connection failure, no shared Traefik container). Separate authorized infrastructure incident: restore shared Traefik and durable ACME persistence without affecting other services; no public/site acceptance can be claimed before that.
- **Git:** `.serena/` is user data; preserve and leave untracked. User authorized commit, push and DEV deployment for this plan. See `git log -1 --oneline` for latest commit.

## Phase P0 — Foundation & database (DEV IMPLEMENTED; QUALITY GATES OPEN)

- [x] pnpm monorepo, Node >=22, React 19/Vite and Fastify 5/TypeScript
- [x] PostgreSQL + Drizzle schema and initial SQL migration
- [x] DEV Docker Compose with PostgreSQL bound to loopback
- [x] `.env` ignored; no credentials in repo; session tokens hashed in DB
- [x] Baseline tests, typecheck, browser build, Postgres/HTTP smoke suite
- [ ] CI pipeline on pull request, >=80% meaningful API coverage, lint / dependency vulnerability scan (Phase P7). CI pipeline/lint/high-severity audit exist; API coverage target still not met.
- [x] 2026-11-04 CI now **enforces** coverage regression gates, not just reporting: Domain ≥80% lines (actual 100%); API temporary floor ≥29% lines (actual 29.34%). Both thresholded commands PASS locally. API 80% goal remains OPEN; do not treat baseline floor as acceptance.
- [x] 2026-11-04 P0 read-only Drizzle/PostgreSQL schema compatibility preflight with 4 unit tests (`apps/api/scripts/check-db-schema-compatibility.ts`): detects current concurrent uncommitted migration-0017 drift (16 missing `billing_batch_runs` columns and 1 `invoices.billing_batch_run_id`), exits nonzero, never applies SQL. Full API unit suite 80/80 and typecheck pass.
- [x] 2026-11-04 add schema compatibility check to GitHub Actions `postgres-security` **after** clean disposable PostgreSQL migration and **before** isolated HTTP security smokes. YAML parsed and 4 targeted unit tests/typecheck pass locally; remote CI result for this uncommitted change is NOT yet verified.
- [x] 2026-11-04 fresh PostgreSQL 16 **disposable Docker** migration dry-run with current WIP migrations through 0017 succeeded; immediate read-only schema preflight PASS (335 Drizzle columns, zero missing). Container was automatically removed. This validates clean-install migration only; not data-preserving DEV upgrade, rollback, or remote CI acceptance. Concurrent session still owns migration 0017; no shared DB migration or WIP stage/commit.
- [x] 2026-11-04 existing root-only DEV backup checksum verification and isolated PostgreSQL 16 restore test re-run: `BACKUP_VERIFIED`, `RESTORE_TEST_OK restored_public_tables=31 network=none`. This confirms restore viability, not migration downgrade/rollback or offsite recovery.
- [x] 2026-11-04 P0 migration-0017 existing-data rehearsal: restored latest root-only DEV logical backup to isolated PostgreSQL 16 `--network none`, applied only pending SQL migration 0017 with fail-on-error, table count 31→32, `invoices.billing_batch_run_id` present and aggregate record-count digest unchanged across organizations/users/leases/invoices/invoice_lines. Test container removed. **No DEV migration.** This checks schema upgrade and selected row counts, not row-content checksums, application-level billing integrity, rollback or financial correctness.
- [x] 2026-11-04 P0 backup-based schema recovery drill: two separate isolated PostgreSQL 16 databases restored from the same protected DEV backup; upgrade applied to first DB only, content digests for organizations/users/leases/invoices/invoice_lines verified equal before and after 0017 (excluding newly added invoice column); second empty DB restored original schema and matched original content digest. All checks PASS. This is recovery from a pre-upgrade snapshot, **not** reversible in-place down migration or preservation of post-backup writes.
- [x] 2026-11-04 P0 **disposable backup-based recovery rehearsal**: `infra/rehearse-apartment-migration-rollback.sh` verifies latest backup checksum, restores to PostgreSQL 16 `--network none` with tmpfs, applies WIP migration 0017 there, then drops **only the disposable database** and restores the original archive. Fingerprints of full original rows in organizations/users/leases/invoices/invoice_lines matched (five tables); migration-added table/column correctly absent after recovery. PASS, no shared DEV writes. This is disaster recovery to the backup timestamp, NOT in-place reversible migration or recovery of writes occurring after the backup.
- [x] 2026-11-04 strengthened isolated recovery rehearsal: explicitly inserts synthetic organization sentinel into restored disposable DB before migration 0017, verifies 5 full-row fingerprints unchanged immediately after migration, then restores original archive and verifies original 5 fingerprints and sentinel absence. PASS. Confirms seeded-data preservation in isolated rehearsal and point-in-time backup recovery; does not guarantee post-backup write preservation.
- [x] 2026-11-04 P0/API coverage continuation: added eight due-reminder service tests for dry-run (no side effects), Bangkok-local date guard, queue eligibility, invoice locking, outstanding balance, pending payment, idempotent already-queued result, and finite integer limit validation. Fixed invalid `limit` (`NaN`/`Infinity`/fractional) passed through to database. API line coverage 29.34% → 30.19% (1451/4805), temporary CI floor raised from 29% to 30%; goal ≥80% remains OPEN.
- [x] 2026-11-04 added 7 `getFinancialPosition` DB aggregation tests (`apps/api/tests/financial-position.test.ts`) for net paid/reversed/credited position, fully paid, missing invoice 404, inconsistent reversal/over-credit/negative money fail-closed 409, and excluded adjustment types. Targeted tests 7/7 PASS; API V8 lines 30.19% → 30.55% (1468/4805). API ≥80% goal remains OPEN.
- [x] 2026-11-04 P0 **encrypted offsite backup/retrieval code** added: `infra/offsite-apartment-postgres.sh` preflights protected local checksum, requires explicit age public recipient and rclone destination, encrypts before immutable upload and checks remote ciphertext readback; `infra/retrieve-offsite-apartment-postgres.sh` requires separately held private identity and retrieves/decrypts into a protected archive without restoring into live DB. `infra/tests/offsite-apartment-postgres.test.sh` eight fail-closed / no-upload checks PASS. Added opt-in restricted systemd offsite service/timer (04:30 Bangkok) with configuration-file guard, syntax verified; NOT enabled. Operator guide: `docs/OFFSITE_BACKUP.md`. An additional fake-age/fake-rclone local uploader flow test checks encryption-first call order, immutable collision rejection, and corrupt remote readback failure (PASS, no network). **Actual offsite upload/recovery still BLOCKED**: age/rclone unavailable and no configured destination/identity; code-only does NOT close DR acceptance.
- **Gate:** baseline build works in isolated DEV and DB migration is reversible without data loss. In-place rollback / post-backup write recovery, actual encrypted offsite upload + recovery acceptance, branch protections and >=80% meaningful API line coverage remain unverified; DO NOT close this gate.

## Phase P1 — Multi-tenant owner & billing foundation (PARTIAL)

- [x] LINE ID-token verification on server (real LINE E2E still pending)
- [x] Session revocation, HttpOnly cookie, DB-backed org access control
- [x] Owners can create organization, multiple properties, rooms with per-room overrides
- [x] Lease creation occupies available room atomically
- [x] Meter reading entry, monotonic validations, unique date/room/type
- [x] Monthly / calendar semi-monthly / rolling 15-day billing calculations (satang / milli-units)
- [x] Single-room invoice preview and transaction + idempotency issue
- [x] Snapshot line items + audit events; reviewed tariff ceiling guard
- [x] Responsive owner/dashboard, room, meter, billing UI
- [ ] P1-01 Room move-out, maintenance and lease lifecycle transitions (PARTIAL)
  - [x] P1-01a Strict owner-only move-out with final meter/invoice settlement guards, no pending claims/finance, room released AVAILABLE or MAINTENANCE, revoked invitations/consents/outbox, audited lease ENDED, real DB/HTTP security tests, Owner UI
    - [x] 2026-11-04 expanded `lease-move-out-authorization.test.ts` to **12 negative transaction tests**: missing property/owner/lease, ended lease, unoccupied room, missing final WATER/ELECTRIC meters, missing final invoice, future invoice, pending payment, pending finance adjustment and unsettled outstanding balance. All fail before updates/inserts; 12/12 pass. API V8 lines 31.65% (1521/4805), up from 31.15%; final P1 browser/UAT and P0 80% coverage remain open.
  - [ ] P1-01b Repair/maintenance ticket workflow and room return-from-maintenance, deposit settlement, former-tenant records access and mid-cycle lease transitions (PARTIAL DEV; P1-03 / P5)
    - [x] Tenant/owner maintenance ticket API and UI, ordered status/audit rules, due-time tracking, maintenance-room return gate; migration 0016 generated and pure workflow tests pass. Details in docs/P5_MAINTENANCE_TICKETS.md.
    - [x] Checksum-verified Apartment-only backup and isolated restore before deployment; migration 0016 applied; PostgreSQL tenant/owner/outsider and room-return HTTP smoke passed
    - [ ] Browser acceptance of owner and tenant maintenance UI (real browser session/UAT)
    - [x] 2026-11-04 former-tenant **read-only historical invoice API and React UI** (`/v1/tenant/history/invoices` + `/:invoiceId`): independently verified active account/LINE subject, lease ENDED, same organization and property, only ISSUED invoices entirely within original lease dates. Past records filtered through fail-closed scope policy, detail returns only permitted line items, `Cache-Control: no-store`; no historical payment/claim actions. 7 pure policy tests and 6 Fastify HTTP injection tests PASS. This is DEV code; real browser/LINE UAT pending.
    - [x] 2026-11-04 deposit settlement **policy preview** implemented: bounded integer satang amounts; prevents negative/overflow balances, over-refunds/deductions/disputes and automatic deduction of rent debt; always requires human review, never auto-pays. 7 domain tests PASS. `deposit-settlement.ts` is not yet backed by a real deposit ledger/database/API, so deposit workflow is still OPEN.
    - [x] DEV persisted manual deposit ledger + two-owner deduction/refund/dispute review API/UI; migration 0018, 14 policy tests, HTTP concurrency/IDOR/immutability tests and real browser deposit flow PASS. No bank transfer or bank-confirmed refund is implied.
  - [ ] Actual refund/reconciliation and review-reservation resolution, legal policy/signoff, tenant-history browser UAT and remaining mid-cycle rules.
- [x] P1-02 Property Master effective-dated rate history, owner authorization, audit and immutable invoice rate snapshots (DEV)
  - [x] Migration 0012 backfills historical master baseline and seeds new properties
  - [x] OWNER-only future full-period rates, legal tariff ceiling and already-issued invoice guards
  - [x] As-of billing-period rate selection, immutable line snapshot IDs and rate-history Settings UI
  - [ ] Formal tenant legal notices and future scheduled-rate correction policy (Production acceptance)
- [ ] P1-03 Active-rate validity for partial leases, mid-cycle adjustments, meter replacement (PARTIAL — DEV)
  - [x] 2026-11-04 P1 canonical mid-cycle transition segment plan API: `GET /v1/properties/:propertyId/leases/:leaseId/billing-segments?endExclusive=...`, verified actor/property/lease scope, respects monthly, 1st/16th and anchored rolling 15-day periods, clips first/last periods, rejects beyond lease end or >366-day horizon. Pure calculation + Fastify HTTP tests **11/11 PASS**. Strict `requirePropertyAdministrator` verifies active OWNER/MANAGER membership (or SUPER_ADMIN) after property scope; 4 additional security unit tests PASS; STAFF grant alone is insufficient. Preview only; actual mid-cycle monetary adjustments and invoice issue are still open.
  - [x] P1-03a Effective-dated room override versions (migration 0013), owner-only full-period schedule, room/current read models, historical billing snapshots and audit
  - [x] P1-03b Explicit MOVE_IN partial billing from actual lease start to canonical period end, prorated rent with real boundary meters, overlap/idempotency guards and UI
  - [x] P1-03c.1 Meter replacement records (0014), old closing/new opening, serial continuity, owner-only audit, segment-aware reading validation and immutable invoice usage snapshots
  - [x] P1-03c.2 Strict final MOVE_OUT partial invoice; actual boundary meters/usage, prorated rent, no overlap, then separate settled-invoice lease closure
  - [ ] P1-03c.3 Legal meter evidence verification, tenant notices, deposit/refund/credit settlement and Production financial-security acceptance
- [x] P1-04 DEV property-level STAFF grants (VIEWER/METER_READER), OWNER-only invite/claim/approve/revoke, manager-denied member management, safe staff property/room listings, auth-scope + in-TX meter grant locks, auditable flows, owner/staff React screens, 0015 migration, real PostgreSQL/HTTP replay/race/IDOR tests
  - [ ] Real LINE Login/LIFF user acceptance, independent security/load QA and worker operational signoff (P2/P7; not Production-ready). See `docs/P1_STAFF_ACCESS.md`
- [ ] P1-05 Negative-amount/overflow/duplicate/concurrency verification gates under load (**IN PROGRESS**)
  - [x] Invoice line/total and `units_milli` PostgreSQL INTEGER bounds; utility arithmetic overflow returns 422; six focused unit cases pass
  - [x] Isolated DEV HTTP smoke script covers negative/fractional/over-limit input, duplicate reading, cross-org access, 16-way same-key replay, 16-way distinct-key issue race, and a bounded 32-way bill-preview burst (76 total HTTP requests)
  - [x] Execute smoke against private PostgreSQL/HTTP runtime: negative/fraction/overflow, duplicate meter, cross-org denial, idempotent replay, unique-key conflict and bounded 32-way preview burst; p95 395/282/275 ms (76 requests total)
  - [x] Larger bounded 64-way preview burst against private DEV runtime: 64/64 returned 200 with stable totals; p95 608 ms (after rate-limit window separation)
  - [x] Additional independent QA security/authorization smoke: 16 concurrent identical meter writes (1 success, 15 conflicts), 48-way mixed-property read burst, 5/5 writes denied after revoke, session/account invalidation; HTTP p95 381 ms for one isolated DEV run. Evidence in `docs/P1_P105_INDEPENDENT_QA.md`.
  - [x] Sustained DEV security-scope check: 60 seconds at 1 RPS; 60/60 expected results (40 HTTP 200 / 20 HTTP 403), p95 14 ms, p99 36 ms, sampled API RSS 236 MB stable, max observed DB connections 4. This is a bounded stability check, not final load acceptance; see `docs/P1_P105_SOAK.md`.
  - [ ] Independent security/load **final acceptance** before closing P1-05: longer monitored soak, explicit SLOs/coverage/CI, threat-model review and realistic browser UAT.
- **Gate:** owner cannot access another organization's property, lease, or invoice; previously issued bill never changes.

## Phase P2 — Tenant onboarding & read-only LIFF portal (IMPLEMENTED LOCALLY; LINE E2E BLOCKED)

- [x] P2-01 Owner generates single-use lease invite: random unguessable token, SHA-256 hash in DB, expiry, revoke superseded tokens, no plaintext at rest
- [x] P2-02 Authenticated tenant claims invite atomically into pending state (NO bill access); owner manually approves verified LINE account before linking lease
- [x] P2-03 Tenant only sees own leases, property/room summaries, issued bills and immutable line items; no IDOR / organization leaks
- [x] P2-04 Mobile LIFF-capable tenant view + owner invite/approve UI (build verified, real LINE/browser E2E pending); clean empty/error states and copyable invitation flow
- [x] P2-05 Tests for expired/replaced/replayed invites, one-winner concurrent claims, owner approval, unrelated tenant IDOR, disabled user/session/organization + real Postgres/HTTP smoke
  - [x] 2026-11-04 additional **8 Fastify HTTP injection tests** with mocked LINE identity and DB transactions (no live credentials): claim pending, expired/revoked/replayed/claimed token denied, lease ended/already-linked denied, disabled user/org/property denied, CAS race denied, explicit owner approval required and revoked/unclaimed/disabled cases denied. Targeted 8/8 PASS. Real sandbox/browser E2E remains pending.
- [ ] P2-06 LINE sandbox E2E with real channel and linked test user (**BLOCKED:** LINE Channel ID + LIFF ID + HTTPS origin). Browser E2E of LIFF flow pending.
- **Gate:** an unapproved LINE account cannot access tenant bills; replayed/expired/revoked invites rejected. A stolen *unused* invite may be claimed but requires explicit owner review/approval before any tenant information is disclosed. Owner must verify claimant identity before approving.

## Phase P3 — Payment & settlement (PARTIAL — DEV IMPLEMENTED, NO BANK API / PRODUCTION OBJECT STORAGE)

- [ ] P3-01 Payment instructions per property: owner-configured bank/PromptPay and **PromptPay QR builder, invoice-scoped API and browser rendering implemented**; real bank-app interoperability and registered recipient verification remain blocked on hands-on acceptance.
  - [x] P3-01a Owner/Super Admin-only bank settings with optimistic CAS, audit, property scope, disabled state and tenant invoice-bound read
  - [ ] P3-01b PromptPay QR core implemented, real bank-app interoperability/recipient-registration check PENDING
  - [x] P3-01b.1 BOT merchant-presented EMV Tag 29/54/63 builder, 10-digit mobile or 13-digit tax/national ID input, integer-satang amount, published golden CRC vector
  - [x] P3-01b.2 Owner and authorized tenant invoice-scoped no-store APIs, direct browser QR rendering, masked ID, copy/save/refresh UX, prevent QR on zero-balance or pending-payment claim, unit + real HTTP IDOR/partial balance tests
  - [ ] P3-01b.3 **BLOCKED on hands-on confirmation:** scan with real bank apps and confirm actual registered recipient name, fixed amount and LIFF/mobile behavior; no bank settlement verification
- [ ] P3-02 Tenant submits evidence securely; **DEV local private evidence implemented**, S3/presigned upload pending
  - [x] P3-02a Authenticated multipart evidence upload with <4 MB, JPEG/PNG/WebP decoder, 12MP limit, EXIF-stripped WebP re-encode, private files 0600, directory 0700, authorized download and rate limit
  - [ ] P3-02b Signed private S3-compatible evidence storage (PARTIAL; live provider/security gate pending)
  - [x] P3-02b.1 AWS SDK v3 S3 adapter, ENV validation, signed 5-minute quarantine PUT (bound size, SHA-256 checksum), HEAD, bounded GET, signed ticket state
  - [x] P3-02b.2 Backend decode, ≤12MP sanitation, metadata-stripped WebP, separate private key, original quarantine cleanup
  - [x] P3-02b.3 Tenant LIFF chooses S3 direct workflow when enabled; single-use READY→CLAIMED ticket bound to verified tenant/invoice with transactional idempotent payment claim
  - [x] P3-02b.4 Real PostgreSQL + local HTTP S3 **mock** test (SigV4 URL shape, checksum mismatch, replay, tenant IDOR, one-time claim and authorized private read); no external keys required
  - [ ] P3-02b.5 **BLOCKED:** live provider IAM/signature/CORS validation with real credentials + HTTPS endpoint, object policy and permitted origins
  - [ ] P3-02b.6 Safe evidence expiry/cleanup and malware scanning (PARTIAL — Production acceptance pending)
    - [x] P3-02b.6a Migration 0007: legal_hold, EXPIRED, expired_at, cleaned_at; dry-run default, explicit org/confirmation apply; expiry grace, row lock, payment claim reference protection and retry
    - [x] P3-02b.6b Isolated PostgreSQL smoke: dry-run, expired ticket, retained legal hold/CLAIMED/referenced evidence and failed-delete retry
    - [x] P3-02b.6c ClamAV TCP INSTREAM adapter: optional DEV, source+sanitized image scans, mock daemon clean/infected/error/timeout/connection refusal tests, fail-closed when enabled
    - [ ] P3-02b.6d Live clamd EICAR/signature update, S3 lifecycle and restore proof, admin legal retention workflow, worker scheduling, metrics, production security QA
  - [x] P3-02c Production startup fails until production evidence/security hardening is implemented
- [x] P3-03 Owner-only manual review/approve/reject with transaction, transfer-reference unique per property, idempotency key, partial payments and overpayment **rejection**
  - [ ] P3-03b Overpayment credit / refund / dispute policy and workflow; automatic bank verification not implemented
- [ ] P3-04 Ledger and receivables reporting (**partial**)
  - [x] 2026-11-04 added OWNER/SUPER_ADMIN scoped `GET /v1/properties/:propertyId/receivables.csv`: same-org/property ISSUED invoice report, repeatable-read transaction, financial position checks, maximum 500 rows (no silent truncation), no-store attachment, strict fixed UUID/date/integer-satang cells preventing spreadsheet formula injection. 5 serializer tests + 5 Fastify HTTP injection tests PASS. Still pending full accounting reconciliation, larger paginated reports and provider/legal signoff.
  - [x] P3-04a Append-only payment Ledger created transactionally with approval, immutable invoice still ISSUED, outstanding and manual-approved totals, overdue counts and aging amounts on Dashboard
  - [ ] P3-04b Financial corrections / refunds / disputes (PARTIAL, legal/bank gates pending)
  - [x] P3-04b.1 Internal credit and manual payment record reversal: append-only entries, original payment Ledger immutable, invoice lock, one original reversal, same-property authorization
  - [x] P3-04b.2 Two-owner workflow: distinct active OWNER request/review; MANAGER rejected; status/idempotency/audit, client request/review UI
  - [x] P3-04b.3 Review-only refund/dispute requests, no cash payouts, no bank-verified settlement; balance reporting separates net manual payments and internal credits
  - [ ] P3-04b.4 Actual refund/chargeback, statutory credit note/tax compliance, reconciliation, dispute evidence & audit sign-off
- [ ] P3-05 Invoice/receipt PDFs and document compliance (PARTIAL: specification only)
  - [x] P3-05a Document type / snapshot / numbering / issuer / access-control / Thai glyph acceptance criteria in `docs/P3_PDF_RECEIPT_SPEC.md`
  - [x] P3-05b Non-tax Billing Notice PDF from immutable amount/lines + issuance-time issuer/property/tenant/room snapshot; Thai font embedded from npm, A4 / multi-page footer, explicit **NOT receipt/tax** banner, owner/tenant authorized download, HTTP IDOR and legacy fallback tests
  - [ ] P3-05c Official receipts, tax invoices and VAT/issuer/retention/legal approval
- [x] P3-06 DEV tenant-IDOR/manager-denial, replay/version-CAS, private evidence, payment status, partial/full/overpay and concurrent-owner approvals HTTP tests
  - [ ] P3-06b Real bank reconciliation E2E, S3 signed-upload E2E, browser/LIFF and production performance/load gates
- **Gate:** no implicit bank payment confirmation. Only recorded **manual owner-reviewed** approvals enter Ledger; immutable invoices remain ISSUED. Production launch needs bank verification policy, legal receipts, cloud evidence storage and security QA.

## Phase P4 — LINE OA integration (IN PROGRESS — DEV)

- [x] P4-01 Provisional one LINE OA per organization (multiple properties), unique org/destination binding, admin-only controlled registration, no secrets in DB
- [x] P4-02 Signed raw-body webhook (HMAC-SHA256 constant-time), 256KiB limit, rate limit, 100-event bound, destination check, atomic event dedupe, no raw PII persistence
- [ ] P4-03 Durable outbox, worker and LINE delivery (PARTIAL; live worker/scheduler pending)
  - [x] 2026-11-04 added repository-only `infra/systemd/apartment-line-outbox-observer.service`: always forces LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false, LINE_OUTBOUND_MODE=disabled at process launch even when ENV config differs; conditional on root-managed env file, restart-on-failure, no new privileges. `systemd-analyze verify` and CI static no-live-sends gate PASS. **Not installed or started; live provider dispatch and alert acceptance still OPEN.**
  - [x] 2026-11-04 TDD fairness bugfix: when organizations have equal usage, unknown queue age (`oldest=null`) no longer outranks queues with known older jobs. Reproduced RED with regression test, fixed null age ordering and verified GREEN 3/3 in `line-fairness.test.ts`. Current API V8 line coverage 31.66% (1522/4806); no external LINE sends or provider acceptance.
  - [x] P4-03a Consent-bound transactional enqueue, stable idempotency/retry key, PostgreSQL SKIP LOCKED worker claim, exponential retry, DEAD/SIMULATED/ACCEPTED states, 23-hour retry-key safety guard
  - [x] P4-03b Real PostgreSQL mock HTTP/outbox tests: valid signature, duplicate delivery, consent revoked, simulated no-send, 429 retry, stable retry key, received status
  - [ ] P4-03c Monitoring/worker operations (PARTIAL — provider/live gate pending)
    - [x] P4-03c.1 Scoped, sanitized Super Admin counters + Dead-letter list, one-time review and audit, migration 0010
    - [x] P4-03c.2 Separate continuous observe-only DEV worker with heartbeat health, 60-second poll, no public port, fail-closed live gate
    - [x] P4-03c.3 TDD unit and real PostgreSQL HTTP tests for role/scope/PII/duplicate review/immutable terminal status
    - [x] P4-03d.1 Durable per-org/global rolling 60-second attempt reservations with cross-worker PostgreSQL advisory transaction lock, bounded ENV quotas and least-used-org selection
    - [x] P4-03d.2 Durable internal incident episodes (Dead-letter unreviewed / expired Sending / queue backlog), duplicate-suppression, auto-resolution, admin acknowledgment and masked UI
    - [x] P4-03d.3 Pure TDD fairness/threshold tests + real PostgreSQL concurrent mock-sender quota and admin incident lifecycle HTTP smoke
    - [ ] P4-03d.4 Real provider quota calibration, multi-channel fairness, external incident paging, production live sender acceptance
    - [x] P4-03e.1 Consent revoke/dispatch race serialization with consistent lease/OA/consent lock order, real mock HTTP concurrency proof; messages already in flight are NOT recallable
    - [x] P4-03e.2 Per-org 30-day min reservation retention, manual dry-run by default and bounded confirmed cleanup with PostgreSQL integration test
    - [ ] P4-03e.3 Alert delivery/retention legal policy, real LINE provider quota, live in-flight uncertainty testing and offsite backup
- [ ] P4-04 Tenant consent and notification event producers (PARTIAL — real provider and future workflows pending)
  - [x] P4-04a Tenant-specific opt-in/revoke endpoints and React UI with explicit purpose acknowledgment, active verified LINE lease scope, audit, idempotent actions, no-store, revoke pending/retry/SENDING jobs
  - [x] P4-04b Invoice-issued Outbox event created atomically with invoice transaction only on active lease + enabled OA + unrevoked exact recipient consent; generic Thai template and eventKey prevent duplicates
  - [x] P4-04c Manual due-date Outbox preparation with Bangkok-day guard, org-scoped dry-run default, explicit confirmation for enqueue, payment/outstanding/pending-claim guards; never sends LINE itself
  - [ ] P4-04d Real LINE Messaging API/LIFF validation and consent policy, invitation and repair event producers (not yet eligible: P5 maintenance and safe invitation contact proof), operator monitoring/scheduling
- [ ] P4-05 LIFF callback/login/logout/tenant invitation with actual LINE sandbox E2E
- **Gate:** no outbound notification without legitimate recipient/consent; retries never double-send from application logic.

- P4-01/02/03 DEV code and tests: see \`docs/P4_LINE_OA_WEBHOOK_OUTBOX.md\`. LIVE sender and consent/notification UX remain blocked.

## Phase P5 — Full property operations (PARTIAL — DEV)

- [ ] P5-01 Monthly and 15-day scheduled bulk invoices (preview → approval → batch process)
- [ ] P5-02 Maintenance tickets and room status workflow; files, notifications, SLA (IN PROGRESS — partial DEV)
  - [x] Summary-only SLA report endpoint; property authorization, no-store response, overdue/due-soon/missing-deadline counts without tenant descriptions; PostgreSQL smoke + unit tests pass (2026-11-05)
  - [x] Private maintenance image attachments: malware scan + re-encoding/metadata stripping, PostgreSQL bytea storage, 2 MB/file and 5/file-ticket limits, owner/tenant scope, audit, no-store download, IDOR smoke and real-browser upload/download at desktop/390/320 (2026-11-05)
  - [x] Tenant/owner tickets, workflow states, audit, due-time/overdue display, room MAINTENANCE entry and guarded return; migration 0016 and service tests. See docs/P5_MAINTENANCE_TICKETS.md.
  - [x] PostgreSQL authorization/lifecycle smoke and migration rollout verified; see `docs/DEPLOY_DOKPLOY_DEV.md`
  - [x] Browser QA, private files/attachments, summary SLA report; owner/tenant attachment upload-download at desktop/390/320 and deployment/migration smoke verified (2026-11-05). Remaining: configurable SLA policy, consent-bound workflow acceptance and independent review.
- [ ] P5-03 Utility meter photo proof; reading anomalies / reset / replacement
  - [x] DEV private sanitized meter photo upload/read and owner-only persisted anomaly assessment (0019), active staff grant checks, idempotency, HTTP and desktop/390px/320px real browser PASS. No reading or invoice mutation from review. Actual scanner/retention acceptance remains separate.
  - [x] 2026-11-04 added scoped read-only `GET /v1/properties/:propertyId/rooms/:roomId/meter-anomalies/:kind?maxDailyMilli=...` and advisory `assessMeterReadingAnomaly` policy. Checks verified property/staff read scope, room org/property, same-scoped last 2 readings and intervening physical replacement; classifies reset, duplicate, change or unusual usage against explicit reviewed threshold. 6 domain + 6 Fastify HTTP injection tests PASS; never auto-adjusts/bills or writes. Persistent anomaly review/evidence/threshold policy and real DB/browser E2E still OPEN.
- [ ] P5-04 Security deposits, move-out settlement, rent/utility disputes, void/credit notes
- [ ] P5-05 Occupancy and revenue dashboard; exports/reporting with access control
  - [x] 2026-11-04 added read-only scoped `GET /v1/properties/:propertyId/occupancy-report` with repeatable-read room/active-lease snapshot and anomaly totals (orphaned occupancy, active lease in nonoccupied room, duplicate active leases), bounded fail-closed response; domain + Fastify HTTP injection tests 10/10 PASS. Added Owner Overview `PropertyOperationsReports` UI with reconciliation warning and Receivables CSV download (web build PASS), plus strict administrator-only access. Financial revenue analytics and browser integration remain open.
- [ ] P5-06 Contract, tenant profile, privacy retention / data export / deletion workflows
  - [x] 2026-11-04 implemented `GET /v1/tenant/privacy/export`: verified active-account LINE identity, only own ACTIVE/ENDED leases and scoped/issued invoice records, ended-lease date policy, no-store JSON attachment, rate limit and fail-closed maximums; Tenant Portal download link. Seven Fastify HTTP injection tests PASS. This does NOT implement privacy deletion, legal retention or full payment evidence portability.
- **Gate:** idempotent bulk runs, reconciliation, audit and proper landlord/tenant privacy separation.

## Phase P6 — Design system & Figma (PARTIAL CODE, FIGMA NOT STARTED)

- [x] 2026-11-04 web CSS keyboard `:focus-visible` ring for links/buttons/form controls and reduced-motion media preference added; web build PASS. Automated accessibility scan and WCAG/visual UAT still OPEN.

- [ ] P6-01 Color / typography / spacing tokens and component states documented in Figma
- [ ] P6-02 Mobile owner: dashboard, rooms, meter, billing, tenant list, payment confirmation
- [ ] P6-03 Mobile tenant: onboarding, bill details, payment evidence, repairs, history
- [ ] P6-04 Desktop Super Admin: owner/tenant overview, compliance, audit and support
- [ ] P6-05 WCAG focus, error/empty/loading states, responsive QA at 320px/390px/desktop
- **Blocker:** user must choose target Figma plan: personal team or SKY ICT team.
- **Gate:** editable Figma layers/components match implementation; responsive design QA.

## Phase P7 — Production security, QA & cutover (PARTIAL — DEV CI/QA ONLY)

- [ ] P7-01 Independent security review: CSRF, tenant IDOR, SSRF, auth/session rotation, role revoke
- [ ] P7-02 CI lint, tests, ≥80% meaningful coverage, API integration and Playwright browser E2E (PARTIAL)
  - [x] GitHub Actions PR/push workflow: pinned Node/Corepack/pnpm, frozen lockfile, Drizzle migration snapshot consistency, API/domain unit tests, typecheck, Web production build, and disposable PostgreSQL 16 migration + HTTP security/finance/LINE/S3-mock tests. See `docs/P7_CI_RUNBOOK.md`.
  - [x] GitHub-hosted CI Run `41750529389` for commit `c908f1c`: quality unit/typecheck/Web and clean PostgreSQL migration+security/finance/LINE/S3-mock jobs passed 2/2.
  - [x] ESLint implemented (0 errors, 37 warnings); V8 unit coverage measured (API lines 29.28%, Domain lines 100%, branches 96.42% (15 new/current Domain test cases)); pnpm audit after workspace security overrides reports 0 Critical / 0 High and 6 Moderate. See `docs/P7_DEPENDENCY_AUDIT.md`.
  - [x] GitHub Actions Run `41751709175` for commit `f9c9e54`: quality lint/coverage/audit/types/Web and clean PostgreSQL security/integration gates both passed after dependency security overrides.
  - [ ] Enforce Required Checks in branch protection and triage remaining ESLint warnings plus six Moderate advisories.
  - [x] P7-02 lint cleanup (2026-11-04): reduced ESLint warnings 37 → 5 (0 errors), leaving 5 in concurrent Bulk Billing working files (API index, batch route, Web main). API 76/76 tests, typecheck and Web build pass. No WIP migration or runtime changes. CI strict zero-warning gate remains open.
  - [ ] Raise meaningful API coverage ≥80% with comprehensive HTTP/browser tests and add Playwright owner/tenant browser E2E; external provider/user acceptance remains gated.
- [ ] P7-03 Multi-tenant isolation tests incl. missing, disabled, suspended membership/lease/property (PARTIAL)
  - [x] 2026-11-04 isolated PostgreSQL/HTTP synthetic QA: cross-property/cross-org deny, disabled property grant, disabled org membership, disabled org, disabled staff account, permission restore/revoke, revoked session; original 48-way read burst and 16-way meter duplicate concurrency preserved. PASS. Test: `corepack pnpm --filter @apartment/api exec tsx scripts/smoke-independent-security.ts` (includes 61s limiter-window interval; no rate-limit bypass).
  - [x] 2026-11-04 additional synthetic DEV PostgreSQL/HTTP: owner tenant sees only own active lease and invoice, cross-tenant invoice detail IDs denied (404 both directions), unknown invoice ID denied, unlinked tenant cannot list invoices, closed lease hides list/detail, disabled org hides tenant invoice, restoring status returns visibility. PASS. Fixture inserts use migration-0016-compatible SQL, never applying concurrent uncommitted migration 0017.
  - [ ] Broader lease/former-tenant access policy and disabled lease state, suspended-state product decision/schema (current `account_status` supports only ACTIVE/DISABLED), independent external security acceptance. No schema changes or deployment.
- [ ] P7-04 Privacy, legal and utility tariff signoff; Thai tenancy, tax/receipt compliance
- [ ] P7-05 Backup/restore proof, migrations with rollback plan, monitoring / alerting
- [ ] P7-06 Secure HTTPS domain, LINE developer callback and Dokploy DEV deployment; smoke
- [ ] P7-07 Performance/load/billing concurrency, owner/tenant UAT; only then prod launch
- **Gate:** prod launch requires security, financial, legal, performance and UAT signoffs.

## Baseline verification evidence (before P2)

- 2026-11-03: `corepack pnpm test` — 11 domain + 8 API unit tests passed
- 2026-11-03: `corepack pnpm typecheck` passed
- 2026-11-03: `corepack pnpm --filter @apartment/web build` passed
- 2026-11-03: `corepack pnpm --filter @apartment/api smoke` passed on real PostgreSQL
- 2026-11-03: `corepack pnpm --filter @apartment/api smoke:http` passed owner 200/403, admin 403, issue 201, replay 200, duplicate 409
- 2026-11-03: Drizzle migrations `0001` + `0002` applied; `lease_invitations` table with hash/expiry/claim/approve/revoke audit state
- 2026-11-03: API unit tests now **11**, domain **11** (22 total), web build passed
- 2026-11-03: Tenant HTTP smoke passed: invite 201, claim 202 without invoice visibility, approve, tenant invoice 200, outsider invoice 404; expired/replaced/replay reject, one-winner concurrent claims, disabled identity/session 401, disabled org hides invoice
- 2026-11-03 P3: `corepack pnpm test` — 11 domain + 19 API tests, `corepack pnpm typecheck` + web build.
- 2026-11-03 P3: `corepack pnpm --filter @apartment/api smoke:http` bank update CAS, tenant-only bank view, manager denied, private sanitized evidence, review/reject, partial+full, replay and 422 overpay passed.
- 2026-11-03 P3: `corepack pnpm --filter @apartment/api smoke:payments` concurrent decisions produce one APPROVE and one 422, ledger amount correct; rate limit responds 429.
- 2026-11-03 P3 S3: Drizzle migration 0005 added evidence_uploads state (INITIATED/PROCESSING/READY/CLAIMED/FAILED); 16 DEV tables.
- 2026-11-03 P3-05b: Drizzle migration 0006 adds invoice document_snapshot and line ordinal for new invoices; old invoices flagged CURRENT_RECORD_LEGACY.
- 2026-11-03 P3-05b: `corepack pnpm --filter @apartment/api test` PDFJS extraction for Thai/money, 70-line pagination, sum mismatch reject; HTTP smoke owner/tenant 200, outsider 404, unauthenticated 401, cross-org 403, snapshot label immutability and legacy disclosure.
- 2026-11-03 P3-05b: PDF visual rendering verified with `corepack pnpm --filter @apartment/api exec tsx scripts/preview-billing-pdf.ts` plus `--long` (7 pages); **not** a legal receipt or tax invoice.
- 2026-11-03 P3 S3: 32 unit tests (11 domain + 21 API); `corepack pnpm --filter @apartment/api smoke:s3` uses local HTTP mock, checksum and tenant IDOR, real Postgres; **NOT real S3 provider IAM/CORS**.
- Storage threat model and provider CORS/lifecycle runbook: `docs/P3_S3_STORAGE_RUNBOOK.md`; legal document requirements: `docs/P3_PDF_RECEIPT_SPEC.md`.
- 2026-11-03 P3-01b: BOT/EMV merchant-presented PromptPay QR built locally; CRC golden BB8A for 0812345678/THB 100, 5 new API unit tests; owner/tenant 200, invalid 400, outsider 404, cross-property 403, disabled 404, pending/full 409, partial-balance update verified with DEV Postgres HTTP smoke. Bank-app recipient confirmation remains outstanding; see `docs/P3_PROMPTPAY_QR.md`.
- Environment variables/keys: `docs/ENV_REQUIRED.md`. No real gateway, actual LINE OA or object storage credentials configured.
- Keep `docs/implementation-status.md` as a short mirror; **this PHASES file supersedes its checklist**.

## NEXT SESSION START HERE (paste this to a new agent)

You are continuing the Apartment SaaS project on **/root/Projects/Apartment** (DEV only). Before coding:
1. Read `AGENTS.md`, `README.md`, and **`docs/PHASES.md`**, especially *Current checkpoint* and the first unchecked item in the active phase.
2. Check `git status --short --branch` and `git log -1 --oneline`; preserve all user work. Current active item is **P1-05**, not P4-01.
3. P1-05's isolated PostgreSQL HTTP/concurrency smoke and 32-way bounded burst now pass; continue with a larger bounded load profile and independent acceptance before closing it.
4. Run `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm --filter @apartment/web build`, and the API PostgreSQL smoke suites when their required local services are available. A restricted sandbox may reject loopback tests; distinguish that from product test failures.
5. Update this file's current checkpoint and verification evidence. Continue with P1-01b/P5 work after P1-05. Keep real LINE, bank, S3 provider, legal, security, offsite backup, and Production acceptance gates pending until verified with the required external inputs. Never mark an invoice PAID automatically.
6. If external secrets or a product decision are required, leave that specific checkbox blocked and continue other independent work.

## Decisions required (do not block local coding)

- One LINE OA per org **provisional**, or one per property?
- Rent in advance vs in arrears; default billing due date, partial month handling
- Receipt/tax invoice identity and regulation review with authorized expert
- Legal admissibility of water/electric tariff values and proof for each property
- Figma target plan selection
- P3 evidence provider and storage keys; PromptPay QR reference standard, refund/credit policy, official receipt identity

- P3-02b.6 DEV: migration 0007, ClamAV INSTREAM fake TCP tests, and PostgreSQL fixture cleanup smoke completed. No real evidence deleted. Read docs/P3_EVIDENCE_RETENTION_MALWARE.md.

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
