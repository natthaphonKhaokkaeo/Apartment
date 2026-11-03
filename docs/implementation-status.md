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
- [x] Domain and API tests (19 tests), real PostgreSQL smoke, authenticated HTTP issuance replay smoke, TypeScript checks, Vite build

## Not yet completed
- [ ] LINE sandbox channel E2E (needs real LINE_CHANNEL_ID + LIFF ID)
- [ ] Tenant portal and tenant account linking/invitations
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
