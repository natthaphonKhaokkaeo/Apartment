# Apartment implementation checkpoint (2026-11-03)
## Implemented
- [x] New git repository /root/Projects/Apartment
- [x] pnpm workspace, TypeScript, Fastify backend, React LIFF-capable mobile web
- [x] Drizzle schema, migration, PostgreSQL dev compose
- [x] LINE ID token verify endpoint, session tokens stored hashed, revocation, HTTP-only cookie
- [x] DB-backed org membership + super admin checks
- [x] Org/property/room CRUD, per-room pricing overrides, leases and readings
- [x] Billing period invariants, preview, and transactional single-room invoice issue with immutable lines
- [x] Compliance review required before invoice issue, Super Admin-only endpoint
- [x] Responsive owner/admin UI, overview, rooms, metering and billing
- [x] Domain and API tests (22 tests), real PostgreSQL smoke, authenticated HTTP issuance and tenant invitation/approval/read-only invoice smoke, TypeScript checks, Vite build

## Not yet completed
- [ ] LINE sandbox channel E2E (needs real LINE_CHANNEL_ID + LIFF ID)
- [x] Tenant account invitation/owner approval + read-only tenant invoice portal (code and Postgres/HTTP smoke; LINE sandbox E2E still pending)
- [ ] Effective-dated historical pricing + move-in/out edge cases
- [ ] Payment reconciliation / deposit / receipts / tax invoices / PDFs
- [ ] LINE OA messaging, raw-body signature checked webhook, asynchronous notification outbox
- [ ] Mass billing and scheduled run, disputes, reversals, credits
- [ ] Restore drill, Playwright E2E, accessibility, production deploy checks
- [ ] Figma file: need destination Figma team selection
- [ ] Legal and utility-provider rate applicability review before customer use

## Current safeguards and known limitations
A user may create their own organization and properties, but cannot access others via owner APIs. Super Admin can traverse organizations. Tariff review is performed via admin input with an evidence reference; it is not automatic legal validation. Invoice issue is blocked without boundary readings and full-cycle lease. Overrides are current values only; retroactive effective-date history is not implemented. Dashboard includes total invoiced, NOT collected revenue. No payment system exists. No true LINE notification sends exist.

## Product decisions needed
1. LINE OA one per organization or per property.
2. Rent paid in advance or after use; billing due-day rules.
3. Which entity issues receipts and potential tax invoices.
4. Compliance reviewer evidence and tariff calculation basis.

## Phase P3 DEV implementation — 2026-11-03
- [x] Property payment instructions, owner-only versioned edits, audit and tenant invoice-scoped display
- [x] Private DEV upload: max 4 MB JPEG/PNG/WebP, decoded / sanitized WebP, protected evidence reads, SHA256, secure file permissions
- [x] Tenant payment claim submissions, owner manual approve/reject, ledger postings and outstanding balances
- [x] Payment dashboard: manually approved, outstanding, overdue aging and count; no bank verification
- [x] Real PostgreSQL + HTTP smoke: cross-tenant denial, version conflict, uploaded evidence, same-key replay, reject, partial+full, overpay denial, concurrent owner approvals
- [x] Unit tests 30/30 total, TypeScript and web build
- [ ] QR generation validation; object storage + signed uploads / malware scanning / restore test
- [ ] Refunds/credits, real bank reconciliation, PDF/official receipts and legal approval
- [ ] Actual LINE login/sandbox, browser E2E, production security review

## Current handoff
Canonical phases: `docs/PHASES.md`. P2 local code complete; LINE sandbox E2E blocked by actual LINE credentials. P3 DEV manual payment foundation implemented; continue P3-02b signed object storage and P3-05 receipt/legal specification; never mark paid without reconciliation.


## P3 signed S3 workflow checkpoint — 2026-11-03
- [x] Private S3 adapter, presigned 5-minute quarantine PUT, checksum/length validation, sanitized WebP
- [x] PostgreSQL evidence_uploads state machine + migration 0005 (16 total tables)
- [x] LIFF direct upload flow selectable via authenticated evidence-upload-mode; local upload preserved
- [x] Real PostgreSQL + local HTTP S3 mock E2E with checksum fail, tenant IDOR, duplicate claim protection
- [x] Document/receipt issuer, numbering and privacy requirements specification
- [ ] Live provider IAM/SigV4/CORS E2E, malware scanner, quarantine lifecycle, backup/restore and retention
- [ ] Non-tax Billing Notice PDF, official receipt/tax legal signoff and real LINE Sandbox
- [ ] Any production enablement; fail-closed guard remains active
Canonical handoff remains `docs/PHASES.md`; full key list `docs/ENV_REQUIRED.md`; S3 instructions `docs/P3_S3_STORAGE_RUNBOOK.md`.


## P3-05b Billing Notice PDF (DEV verified; 2026-11-03)
- [x] A4 Thai PDFKit renderer, embedded Noto Sans Thai, pages/footers, explicit non-receipt/non-tax warning
- [x] Immutable saved line totals + new invoice document_snapshot, migration 0006 and invoice line ordinal
- [x] Old invoices use current metadata only with explicit legacy warning
- [x] Authenticated owner and tenant PDF downloads: no-store, IDOR/unauthenticated test gates
- [x] PDFJS Thai/money extraction, visual raster inspected single-page and 7-page document
- [ ] Official receipts/tax PDFs, legal issuer/VAT, document numbering, signed storage/retention, real LINE browser UAT
Next: P3-01b PromptPay display-only QR. Canonical plan: docs/PHASES.md.


## P3-01b PromptPay QR (DEV complete; external bank scan pending) — 2026-11-03
- [x] BOT/EMV Tag 29 PromptPay AID, mobile/tax identifier, THB tag 54, CRC16 unit + golden-vector tests
- [x] Authorized owner/tenant invoice QR APIs with full ID only in no-store payload; masked UI
- [x] Fixed invoice outstanding amount computed from manual ledger, no QR while pending claim or fully recorded
- [x] Client-side QR rendering, manual-refresh and download; no external QR rendering service
- [x] Real Postgres HTTP smoke: owner/tenant 200, cross-org 403, unauthorized tenant 404, inactive account 404, partial balance and pending/full guard
- [ ] Scan with actual banking apps and verify registered receiver and amount; real LIFF/HTTPS E2E
- [ ] Real bank reconciliation and official receipt (not part of QR rendering)
Canonical plan: docs/PHASES.md. Details: docs/P3_PROMPTPAY_QR.md.

## P3-02b.6 DEV — safe orphan cleanup and optional scanner
- [x] Expiry state + legal hold + DB row locking + payment claim protection
- [x] Manual DRY_RUN default, explicit org-scoped two-flag apply, failed-delete retry
- [x] ClamAV INSTREAM fail-closed adapter and isolated mock TCP tests
- [x] PostgreSQL fixture cleanup smoke with legal hold/linked payment and retry protection
- [ ] Real ClamAV EICAR, S3 lifecycle, orphan inventory, backup/restore, legal policy/admin holds, scheduled worker and production security
Next: P3-04b credit/refund/dispute policy, or real provider verification when ENV is available.

## P3-04b DEV finance and deployment — 2026-11-03
- [x] Separate active OWNER requester and reviewer, append-only corrections with original payment Ledger unchanged
- [x] Internal credits and manual payment reversals update effective outstanding; refund/dispute review only has no transfer
- [x] Real PostgreSQL HTTP smoke, unit tests, migration 0008, frontend request/review UI
- [x] GitHub main pushed and local Docker Compose built and running on loopback, health 200 / auth guard 401
- [ ] Dokploy-managed registration (missing authorized API key), public HTTPS/LINE, real refund, statutory credit note, bank reconciliation
NEXT: P4-01 LINE OA durable outbox and webhook contract, or Dokploy registration after access is available.
\n## P4-01/02/03 DEV LINE OA — 2026-11-03\n- [x] One OA per owner org binding (schema), admin binding route, HMAC raw webhook signature, event dedupe; no inbound raw message text stored\n- [x] Explicit lease/binding/recipient consent record required before internal enqueue; outbox retry UUID, 429 retry, 409 accepted only if prior acceptance header, dead-letter state and simulate-only mode\n- [x] PostgreSQL HTTP webhook/outbox smoke with wrong signature, duplicate event, revoked consent and 429→accepted replay; mock outbound does not contact LINE\n- [ ] Real LINE OA secret/token and HTTPS sandbox integration, LIFF consent UI, event notification templates, monitored worker schedule and quota audit\n- [x] Dokploy Project Apartment, env dev and Compose Apartment DEV registered using existing scoped key; Git main/compose path configured\n- [ ] Actual Dokploy Compose deploy (tool safety block) and public HTTPS; existing standalone DEV on loopback 18088 continues running\nNext: P4-04 opt-in/notification source and authorized Dokploy deployment. See docs/P4_LINE_OA_WEBHOOK_OUTBOX.md.\n
### Update: Dokploy managed DEV verified RUNNING after tool response block
- [x] Compose status done, Docker project labels apartment-dokploy-dev-ajcnbm; API and web containers Healthy
- [x] Loopback 127.0.0.1:18089 web/readyz HTTP 200, unauthenticated API HTTP 401
- [x] Old temporary 18088 Compose stopped without volumes; separate DEV PostgreSQL remains Healthy
- [ ] Running managed image must be redeployed to include P4 code once commit is pushed.

### Managed DEV P4 rollout still pending
- [x] Commit 3fd4fb6 pushed with signed webhook/outbox + PostgreSQL smoke; no real LINE key
- [ ] Runtime update via Dokploy: tool blocked compose.redeploy response. Managed containers still pre-P4: webhook 404. Runtime WEB_ORIGIN old 18088 rejects POST from 18089 with 403; private file updated, redeploy required.

## P4-04 Tenant consent / transactional bill-issued and due-date Outbox (DEV)
- [x] Authenticated LINE-linked tenant grants/revokes for own active lease; explicit policy acknowledgement, audit, no-store, IDOR guard, React UI and not-live notice
- [x] Consent cancellation dead-letters pending/retry/SENDING Outbox entries, regrant does not resurrect DEAD
- [x] Invoice issuing atomically creates generic Thai BILL_ISSUED notification only if OA/lease/consent eligible, uses stable unique event key and leaves invoice safe when no consent
- [x] Due reminder manual queue with exact Bangkok-day and org filters, dry-run default, pending payment/zero balance skipping, no real send
- [x] PostgreSQL HTTP smoke and unit tests (cross-user, missing OA, explicit acknowledgement, invoice replay, consent revoke, due idempotency)
- [ ] Real LINE Login/LIFF/Messaging Sandbox, receiver/consent legal review, invitation/repair workflows and continuously monitored sender
Next: P4-05 real LINE sandbox if credentials configured; otherwise P4-03c operational worker and P4-04d owner-facing notification settings. See docs/P4_TENANT_CONSENT_NOTIFICATIONS.md.

### P4-04 deployed DEV verification
- [x] GitHub commit d01e1c2 pushed and Apartment-only Docker Compose rebuilt/recreated under Dokploy, public HTTPS 200 + /readyz 200, auth 401, unconfigured LINE webhook 503, outbound disabled.
- [x] Due CLI dry-run no write; --apply without confirmation rejected.
- [ ] Live LINE Login/LIFF/Outbound Sandbox still untested; do not enable real sends until credentials and policy approved.

## P4-03c safe LINE Outbox Monitoring DEV
- [x] Per-organization Super Admin counters and masked Dead-letter review, no sender/recipient data
- [x] One-time terminal acknowledgment with audit, no retry/requeue
- [x] Independent continuous Observe-only Docker process with heartbeat and no network port
- [x] HTTP PostgreSQL admin security, organization scope, PII, duplicate and no-retry tests
- [ ] Provider live quotas/fairness, operational paging, LINE sandbox and in-flight revocation acceptance
See docs/P4_LINE_OPERATIONS.md.

### P4-03c live DEV verification
- [x] Commit 983fd6b pushed; Apartment-only managed Docker Compose build and up successful; 3 containers API/web/line-observer Healthy, PostgreSQL Healthy.
- [x] Public HTTPS/readyz 200 trusted TLS; unauthenticated line operations API 401.
- [x] Observer heartbeat updated, LINE_WORKER_MODE observe, LINE_WORKER_APPROVED false and LINE_OUTBOUND_MODE disabled, dispatched 0.
- [ ] Actual LINE provider sandbox/live sender, paging/quotas and production acceptance pending.

## P4-03d quota, fairness and durable internal alerts
- [x] Conservative rolling 60s global/per-org attempt reservations with PostgreSQL serialization and least-used-org selection; no provider calls in DEV.
- [x] Configurable bounded quotas and Super Admin quota usage display.
- [x] Durable deduped incidents: DEAD unreviewed, expired SENDING lease and backlog older than 900s; observer reconciles and auto-resolves.
- [x] Admin incident list/one-time ack with audit, no cross-org read, no resubmit or external paging.
- [x] Pure TDD fairness/threshold + concurrent PostgreSQL mock sender and HTTP incident lifecycle tests.
- [ ] Real LINE quota verification, external paging, durable retention, multi-OA credential routing and live-send security acceptance.
See docs/P4_LINE_QUOTAS_ALERTS.md.

### P4-03d deployment verification (DEV)
- [x] Git feature 826550c and explicit quota DEV Compose 9295d2e pushed; Docker API/Web rebuilt and only Apartment containers recreated.
- [x] Three managed app containers + reused PostgreSQL Healthy, migration 0011 / 25 tables.
- [x] HTTPS / and /readyz 200 with valid TLS; unauthenticated Admin Incident API 401.
- [x] Independent observer heartbeat updated, output dispatched=0; observe mode, no live worker, quota config perorg5/global20.
- [ ] Real LINE provider acceptance, end-user LIFF login, operator external paging and secure cert persistence still pending.

## P4-03e safety / Data protection
- [x] LIVE worker double-check with FOR SHARE locks on active lease, enabled OA, active consent during provider request; tenant revoke takes conflicting write locks in same lease->consent order.
- [x] Real HTTP/PostgreSQL race smoke: revoke waits for mock provider call; new enqueue after revoke fails, no extra sends; old in-flight delivery cannot be recalled.
- [x] 30-day min org-scoped manual reservation cleanup, default dry-run, bounded delete and PostgreSQL scope tests. Not scheduled.
- [x] Existing Apartment PostgreSQL Docker volume persistent; automated daily backup at 03:30 Asia/Bangkok using systemd, 14d local retention. pg_dump+sha256 and isolated actual restore 25 tables passed, service start successful.
- [ ] OFFSITE encrypted backups/alerts, real LINE sandbox live acceptance, external alert paging and production in-flight uncertainty review.

### Verified P4-03e DEV deployment and backup runtime
- [x] Git b0d55eb pushed and DEV Compose API/Web/Observer rebuilt/deployed, all Healthy, separate PostgreSQL Healthy.
- [x] HTTPS/readyz 200 trusted TLS, unauthenticated Admin Alerts 401, LINE observer heartbeat fresh/outbound disabled.
- [x] PostgreSQL root-only local backup timer active daily 03:30 Bangkok; service execution 0/success, SHA256 verified, isolated PostgreSQL 16 restore test passed with 25 public tables.
- [x] 63 unit tests and full regression green, real PostgreSQL consent race and retention tests green.
- [ ] Encrypted offsite backup + external alerting, live LINE Sandbox/auth/LIFF, provider acceptance, ACME persistence and Production security gate.

## P1-01a move-out strict closure (DEV)
- [x] Owner-only authenticated org/property/lease scoped move-out endpoint and Owner Rooms UI; Manager, outsider and tenant cannot move-out.
- [x] Final utility readings, final issued invoice matching exclusive end, zero outstanding all invoices, no pending claims/finance; lock property+lease+room, no implicit writeoffs.
- [x] On success lease ENDED, room AVAILABLE/MAINTENANCE, invitations/LINE consent and pending outbox revoked, immutable invoice/payment ledger retained, audit record.
- [x] Unit date policy + HTTP/PostgreSQL IDOR/settlement/duplicate/reuse smoke.
- [ ] P1-01b maintenance ticket and tenant-history/deposit/partial period support. Not full P1 completion.
See docs/P1_LEASE_MOVE_OUT.md.

### P1-01a DEV rollout verification
- [x] Commit f94e6a4 pushed; Apartment-only API/Web/LINE observer rebuilt/deployed Healthy, PostgreSQL Healthy.
- [x] Public HTTPS/readyz 200, unauthed move-out POST 401, LINE outbound disabled; daily backup timer active.
- [x] Full regression and 64 unit tests, real DB move-out permissions/settlement/replay/room reuse passed.
- [ ] P1-01b repair/deposit, midcycle bill, former-tenant history and production safety still pending.

## P1-02 Property Master rate history (DEV, 2026-11-03)
- [x] Migration 0012 baseline backfill and new-property trigger; active rates stored in append-only API versions, rate actor/reason/audit.
- [x] Owner-only future full-period rate schedules with legal reviewed ceiling and issued-bill conflict guard.
- [x] Period-start rate selection and version references in immutable invoice line snapshots. Prior invoices unchanged.
- [x] Settings rate history and future scheduling UI, property read projections show current rate.
- [x] 66 unit tests, PostgreSQL HTTP billing/authorization, full regression, typecheck, build, Docker DEV deployment and HTTPS smoke passed.
- [ ] P1-03 dated room overrides, midcycle prorating/meter replacement; P7 notices, correction policy and legal signoff.
Read docs/P1_PROPERTY_RATE_HISTORY.md.

## P1-03a/b — Room tariff history and exact move-in proration (DEV)
- [x] Room rate version history migration 0013 with existing-room backfill and new-room baseline trigger. No historical invoice recalculation.
- [x] OWNER-only date/version/cap scheduling, historical GET, deprecated unsafe direct PATCH rates. Current room read model and owner history UI.
- [x] Billing resolves as-of master + room rate IDs for each RENT/WATER/ELECTRIC snapshot.
- [x] Partial MOVE_IN from lease start to billing-period end with actual boundary meters; prorated satang rent, idempotency and no interval double bill.
- [x] Pure boundary/date tests, PostgreSQL/HTTP rate/old bill/partial issue tests, full existing regression green.
- [ ] P1-03c meter replacement, MOVE_OUT partial final bill, deposits/credits and legal acceptance. See docs/P1_PARTIAL_BILLING_AND_ROOM_RATES.md.

### P1-03a/b verified DEV deployment
- [x] Feature commit ccbd4fb pushed; Apartment-only API/Web/Observer rebuilt and Healthy, existing PostgreSQL Healthy with 27 tables.
- [x] Public HTTPS/readyz 200, unauthenticated room price GET and MOVE_IN preview POST 401; LINE outbound disabled, backup timer active.
- [x] 70 unit tests and full PostgreSQL/HTTP/payment/finance/LINE/S3/cleanup regression passed. P1-03 remains partial.
- [ ] P1-03c partial MOVE_OUT, meter replacement continuity, deposit policies and legal/security acceptance pending.

## P1-03c Meter changes and final move-out billing (DEV)
- [x] Immutable meter swap history + serial chain/closing-opening values/actor/evidence reference (migration 0014).
- [x] Owner-only transaction, automatic new-meter opening reading, per-device monotonic reading guard.
- [x] Multi-device usage correctly aggregated in invoice-line snapshot, with replacement IDs; old invoice/ledger preserved.
- [x] Guarded MOVE_OUT partial rent+utility invoice, overlap protection, unpaid last invoice blocks lease closure; explicit paid close changes room disposition.
- [x] Owner UI meter swap/history and final partial invoice option; pure TDD and PostgreSQL HTTP integration tests.
- [ ] Physical evidence verification, tenant notice, deposit handling, Production security/legal acceptance and external provider gates.
See docs/P1_METER_REPLACEMENT_MOVE_OUT.md.

### P1-03c verified DEV deployment
- [x] Git fc4ed64 pushed to main; Apartment API/Web/LINE observer rebuilt and deployed, all Healthy, original PostgreSQL Healthy with 28 tables.
- [x] Public HTTPS/readyz 200 trusted TLS, anonymous Meter Replacement/Final MOVE_OUT Preview 401.
- [x] 75 Unit Tests, full existing PostgreSQL/payment/finance/LINE/S3/cleanup regression green.
- [x] LINE Observe-only, outbound disabled; Postgres backup timer active.
- [ ] Verified physical evidence, deposit/refund legal policy, offsite backups and Production security acceptance pending.

## P1-04 Property staff access (DEV, 2026-11-03)
- [x] Migration 0015: STAFF role, property_staff_level and invitation/property-grant tables; backup verified before migration, applied to dedicated Apartment DEV PostgreSQL.
- [x] OWNER-only 24h token invitation and manual identity approval, audit, claimed/approved/revoked state, member/grant revoke; not sent through LINE automatically.
- [x] VIEWER may read only assigned property/room/meter-safe views; METER_READER additionally writes meter readings; finance, lease, billing and rate API blocked for STAFF. OWNER/MANAGER unchanged; MANAGER cannot manage members.
- [x] Meter reading STAFF grant rechecked with PostgreSQL share locks inside transaction to serialize against revocation.
- [x] React OWNER staff invitation/approval/revoke UI, pending staff claim UI and property-scoped STAFF room/meter read UI; staff avoids financial API calls.
- [x] Unit tests 67/67, TypeScript and web build; real PostgreSQL/HTTP staff tests for cross-org and cross-property IDOR, replay/approval race, safe projections, role restriction and revoke. Regression suites: smoke, smoke:http, payments, finance, S3 mock, cleanup, LINE webhook and consent passed.
- [ ] Live LINE browser E2E, independent security/long-running load QA and Production signoff remain P2/P7 gates.
- [ ] Document final Git SHA and managed DEV deployment verification after rollout.
See docs/P1_STAFF_ACCESS.md. Next P1-05 edge/load gates and P1-01b/P5 maintenance.
