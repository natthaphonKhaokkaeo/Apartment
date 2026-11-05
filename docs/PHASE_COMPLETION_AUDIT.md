# Phase completion audit — 2026-11-04 (DEV, not Production)

Source of truth for checklist states: `docs/PHASES.md`. A completed unit implementation is **not** the same as user acceptance, certified infrastructure, or legal/Production sign-off.

| Phase | Observed implementation | Open gates |
| --- | --- | --- |
| P0 Foundation | Monorepo, Fastify/React/PostgreSQL, migrations, DEV Compose, core auth and test suites | CI 2/2 remote green, lint and high/critical dependency audit now present; branch enforcement, API line coverage >=80%, remaining Moderate advisories and proven migration rollback pending |
| P1 Property/Billing | Room/lease/bill, rate history, meter replacement, staff scope, move-in/out and maintenance in DEV | Deposits/refunds/former-tenant record policy, owner/tenant browser UAT, legally verified meter/tariff evidence, duration/throughput acceptance |
| P2 Tenant/LIFF | Hashed invitation, tenant claim and owner approval, access-isolated tenant billing UI | Actual LINE Channel ID, LIFF ID, linked sandbox test users and real mobile/browser callback/login UAT |
| P3 Payment | PromptPay QR builder, manual owner ledger, bounded private/S3-mock evidence, informational PDF, two-owner adjustments | Real recipient confirmation in bank app; live S3/IAM/CORS; actual ClamAV; refund/settlement policy; receipt/VAT/tax/retention legal review |
| P4 LINE OA | Signed webhook, consent and outbox with disabled external sends; observer and quotas | Real provider/sandbox, quota calibration, consent/marketing/legal review, live sender and event notifications, paging policies |
| P5 Operations | Maintenance and room state DEV verified; Bulk Billing implementation in **another session's uncommitted working tree** | Integration/migration 0017 pending, attachments/anomalies, deposit, occupancy/export, contract/tenant profile, privacy and SLA workflows |
| P6 Figma | Not started | User must choose authorized workspace/team before creating editable assets; visual design QA pending |
| P7 Production QA | Partially implemented GitHub Actions workflow and independent DEV security checks | Remote CI confirmed green, lint/coverage/Playwright, penetration/IDOR/CSRF/SSRF review, offsite restore, regulatory/financial sign-off and UAT |

## 2026-11-04 additional implementation evidence
P7-03 synthetic tenant invoice isolation and lease lifecycle read gates are now tested in isolated HTTP/PostgreSQL smoke, including bidirectional foreign invoice IDs, closed leases and disabled organizations. PASS. This closes specific security test gaps, **not** prior phase acceptance. No local coding can truthfully close LINE-provider, real bank, real S3/ClamAV, legal/tax, user acceptance or shared HTTPS proxy repair without external evidence/authorization. Bulk Billing migration 0017 is another session's uncommitted work and was deliberately not applied.

## 2026-11-04 predecessor-phase audit addendum
P0 backup verification and no-network isolated restore were repeated successfully (31 public tables), but migration downgrade/rollback and offsite disaster recovery remain open. A new read-only Drizzle-vs-Postgres compatibility preflight reports 17 expected schema gaps caused by another session's uncommitted Bulk Billing migration 0017; no migration applied. API 80/80 unit tests and typecheck pass. P0 remains PARTIAL; so do P1–P7 with the external and policy gates above. Do not mark an entire phase complete on the basis of a successful subset of tests.

## 2026-11-04 CI preflight verification update
Added a schema-code compatibility check to the isolated GitHub Actions PostgreSQL job immediately after migrations. Verified locally via YAML parse, ordering, targeted tests (4/4) and API typecheck. This does not close P0: the gate is not remote-verified, 80% API coverage and rollback/offsite proofs are still missing, and concurrent Bulk Billing 0017 is not applied. Do not modify the shared DEV schema to satisfy a test.

## 2026-11-04 isolated migration verification
A disposable loopback-only Docker PostgreSQL 16 database successfully migrated from empty using checked-out migrations through uncommitted 0017. Drizzle column preflight PASS (335 columns, zero missing). Container was removed automatically; no shared DEV migration/deploy. Current production-like DEV remains at 0016 and schema drift is expected until coordinated rollout. API measured 29.34% line coverage (below 80%). P0 is **not complete** until an isolated seeded-data upgrade/rollback drill, offsite recovery, enforced CI and adequate coverage pass; P1–P7 also retain external signoffs.

## 2026-11-04 real-backup isolated 0017 rehearsal
Restored the current protected DEV backup on an ephemeral `--network none` PostgreSQL 16 Docker container, then applied the pending 0017 SQL only on that clone. PASS: public base table count 31→32, new invoice billing-batch column present, row-count digest across five key finance/tenant tables unchanged. No live DB migration or WIP overwrite. P0 remains open for content-level integrity, rollback and offsite recovery, CI enforcement/coverage. Tests requiring provider credentials and approvals across P1–P7 remain blocked until verified.

## 2026-11-04 P0 recovery drill verification
Two isolated databases in a disposable no-network PostgreSQL container: upgraded copy of protected backup through 0017 retained equal digests of original columns for organizations/users/leases/invoices/invoice_lines; separately restored backup to an EMPTY database retained baseline digest and absence of 0017 invoice column. PASS. This is backup-based point-in-time recovery, **not** an in-place down migration, recovery of new transactions, offsite DR or Production acceptance. P0 remains PARTIAL; P1–P7 retain their earlier independent gates.

## 2026-11-04 P0 recoverability addendum
A repeatable, safety-scoped `infra/rehearse-apartment-migration-rollback.sh` now verifies latest Backup checksum, restores to temporary networkless PostgreSQL 16, applies 0017 there, re-restores the original backup, and confirms five full-row content fingerprints and old schema shape. PASS, isolated container cleaned and DEV unchanged. This is a backup-point recovery test, not full in-place rollback or recovery of post-backup writes; P0 remains PARTIAL pending offsite disaster recovery, meaningful API >=80% coverage, branch rules and appropriate migration rollback strategy.

## 2026-11-04 P0 seeded-data integrity and branch enforcement audit
Isolated recovery drill now inserts a synthetic organization row before applying 0017 and checks five table full-row fingerprints pre/post migration; point-in-time recovery restores original fingerprint and removes sentinel. PASS. This does not validate new writes after backup. GitHub branch-protection API read denied 403 due to integration permissions; repository rulesets list empty; no gh CLI on VPS. Required checks could not be verified or enforced. P0 remains PARTIAL, API line coverage last measured 29.34% vs required ≥80%.

## 2026-11-04 CI coverage regression improvement
CI quality job now runs Vitest with enforced minimum line coverage. Domain ≥80% (actual 100%), API temporary ≥29% (actual 29.34%) both pass on VPS. This prevents immediate API coverage regression but is explicitly **not** the P0/P7 API ≥80% requirement. More integration test work, enforced GitHub required checks, offsite backup and provider/legal signoff remain. No remote CI run has been claimed for the uncommitted workflow change.

## 2026-11-04 API coverage and due reminder safety
Eight targeted no-provider-send due-reminder tests now pass; one test-first change fixed invalid non-finite/fractional request limits before reaching database query. API coverage 29.34%→30.19% lines (1451/4805), temporary CI threshold 29%→30%. Final 80% remains outstanding; P0 NOT COMPLETE. No changes made to other session's migration or DEV DB.

## 2026-11-04 P0 financial aggregation regression tests
Seven newly added `getFinancialPosition` service tests exercise ledger aggregation, fail-closed inconsistent money, credits/reversals, full settlement and missing invoice. Targeted 7/7 PASS; measured API V8 line coverage 30.55% (1468/4805), up from 30.19%, still far short of required ≥80%. No schema, deployment or live financial changes; previous external/legal/provider gates and P0 completion blockers remain.

## 2026-11-04 all-phase review and P1 move-out security coverage
Re-reviewed P0–P7 unchecked checklists: there are still open gates in **every phase**. Added 7 mocked transaction negative tests to P1-01 move-out authorization and final meter prerequisites; no state writes on denied requests. PASS. API V8 line coverage 31.15% (1497/4805) vs required 80%; temporary CI floor 31%. This is targeted evidence only, not external-provider, legal, browser, independent security or production acceptance. Bulk Billing migration 0017 remains another session's uncommitted WIP; no changes to shared DEV database.

## 2026-11-04 P1 financial move-out guard test extension
All prior phase gates remain open as documented above. Expanded P1-01 transaction-level denial tests to 12 cases, adding missing final invoice, later-dated invoice, pending payment/finance review and unsettled balance. All 12/12 PASS before writes. API line coverage 31.65% (1521/4805), still well below 80%; no provider/UAT/legal acceptance implied. No live DEV migration or modification of concurrent Bulk Billing 0017.

## 2026-11-04 P4 line queue fairness bug fix
Prior phase audit still shows P0–P7 PARTIAL. Identified queue priority bug: organizations with unknown oldest job age were treated as 1970 and prioritized before known older jobs at equal usage. Test-first regression reproduced failure; fix sorts missing age after known timestamps while keeping quota and prior usage ordering. Targeted 3/3 GREEN. API V8 lines 31.66% (1522/4806), not >=80%; P4 provider live delivery still blocked. No shared DEV DB changes or outbox sends.

## 2026-11-04 coding-first P0–P7 rescan (LINE configuration deferred)
The ordered coding/acceptance register is `docs/CODING_PHASE_BACKLOG.md`. P0 now has encrypted age+rclone offsite upload/retrieve scripts with SHA-256 preflight/readback, strict key/remote validation, overwrite refusal, and non-destructive retrieval. Eight no-upload shell preflight/denial tests pass and GitHub Actions quality job checks shell syntax. **Actual offsite encrypted transfer and disaster recovery are NOT verified**: no age/rclone tools or external remote provisioned; no LINE credentials were required or set. Existing CI API coverage still 31.66% versus 80%; no phase is fully accepted and no shared DEV migration or deploy was executed.

## 2026-11-04 coding-first offsite upload failure-path verification
P0 offsite shipper local mock integration `infra/tests/offsite-upload-mock.test.sh` exercises the full upload orchestration with test-only age/rclone shims: ciphertext-before-upload stub path, immutable collision rejection, corrupted remote readback detection, simulated encryption failure and simulated upload failure all PASS without network. This validates fail-closed script logic, not actual remote encryption/storage or restore. P0–P7 coding and acceptance gaps remain detailed in `docs/CODING_PHASE_BACKLOG.md`; LINE configuration is explicitly deferred. No shared DEV schema changes, deploy, commit or push.

## 2026-11-04 P1 domain and historical invoice authorization progress
Added monetary-safe deposit settlement preview with seven domain tests and no real refund side effects. Implemented verified-subject/scope/date-bounded former-tenant invoice history API plus read-only React view, with seven policy tests and six Fastify inject tests. Historical access fails closed for other subjects/orgs/properties, voids, malformed/late invoice periods and inactive users. This closes a DEV code gap but **not** the persisted deposit ledger/refund workflow, real browser/LINE E2E or legal/finance signoff. API V8 line coverage measured 33.50%; target >=80% remains unfulfilled. No shared DB migration, commit or deployment.

## 2026-11-04 P2–P6 gap reduction
P2 invite claim/owner approval HTTP mock tests 8/8 pass. P3 new owner-scoped receivables CSV export and no-PII satang serializer have 10 focused tests with repeatable-read and fail-closed limit. P5 read-only authorized meter anomaly preview has 12 focused tests; actual recording/billing remains separate. P6 added keyboard focus and reduced-motion CSS, build pass. P1 former-tenant history full-stack and deposit policy preview exist, but deposit persistence still requires coordinated migration. API line coverage measured 37.08%, far below 80%, and independent browser/provider/DR/security signoffs remain. No shared DB migrations, deployments, commits or pushes made.

## 2026-11-04 further P1/P5 coding coverage
Added strict active OWNER/MANAGER/SUPER_ADMIN property authorization guard (4 focused tests) to billing preview and occupancy report; added owner Overview UI for occupancy/reconciliation and receivables CSV. Added canonical lease billing segment preview including owner property authorization and 15-day anchor math (11 tests), privacy subject-scoped export of own leases/issued invoices with no-store and bounded data (7 tests), and property occupancy reconciliation with anomalies in repeatable-read transaction (10 tests). All are safe, read-only API additions; privacy export has a Tenant Portal link. API line coverage 39.68% (2117/5335), still far below >=80%, and P0–P7 NOT completed. Deposit persistence/migrations, LINE provider E2E, privacy deletion and legal/browser acceptance remain OPEN. Concurrent migration 0017 untouched.

## Operationally safe next steps

1. Complete CI remote execution evidence, add lint/coverage and owner/tenant browser E2E with synthetic test identities. Keep production features locked.
2. Continue P1-05 bounded security tests and profile, and independently implement non-conflicting DEV work.
3. Coordinate migration 0017 with the session owning P5 Bulk Billing. Do **not** stage their uncommitted changes, apply that migration prematurely, or deploy a partial schema/API combination.
4. Define policy for deposits, refunds, tax receipts, former-tenant access and data deletion with the product/legal owner before enabling financial side effects.
5. Configure external LINE/LIFF, cloud object storage and bank-app QA through approved secrets management, then conduct actual-provider tests. Never put credentials in code, docs or chat.
6. Public HTTPS is currently DOWN after reboot (TCP 443 unavailable; shared Traefik container absent). Confirm durable Traefik ACME certificate storage and offsite backups via separately authorized infrastructure maintenance without restarting shared services in an Apartment feature session.

The missing items above are **not** considered DONE until there is fresh code, repeatable automated test evidence and required human/provider acceptance where applicable. No live LINE sending, real bank settlement or production cutover is authorized from this audit.
