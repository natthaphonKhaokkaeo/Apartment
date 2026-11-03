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
