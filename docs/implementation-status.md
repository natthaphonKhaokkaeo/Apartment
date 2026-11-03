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
