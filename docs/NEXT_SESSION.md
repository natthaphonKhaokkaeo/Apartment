# Apartment — START HERE (new coding session)

**Canonical progress plan:** [PHASES.md](PHASES.md). Read it before editing or estimating status.

## Mission

Continue the Apartment LINE-first multi-tenant SaaS in `/root/Projects/Apartment`.

**Start with P3-01b:** implement **display-only Thai PromptPay QR** after validating the official format and CRC. Use property payment settings scoped to authenticated tenant's invoice; it must never auto-approve or post to Ledger. Unit test invalid identifiers, payload encoding, amount optional/fixed policy and tenant IDOR.

**P3-05b is implemented in DEV:** scoped owner and linked tenant can download an A4 Thai Billing Notice PDF with immutable invoice-line amounts and an issuance-time snapshot of issuer/property/address/room/tenant. Historical invoices without snapshots display a clear current-record metadata warning. This document is **NOT** a payment receipt or tax invoice. See docs/P3_PDF_RECEIPT_SPEC.md.

P3-02b Signed S3 upload code is implemented for DEV and passes `smoke:s3` using a local HTTP mock with actual PostgreSQL. It is **NOT yet verified against a real cloud/S3-compatible provider**, so P3-02b remains unchecked. When the user configures storage ENV, validate provider IAM + SigV4 signature verification, CORS, browser LIFF flow, lifecycle, malware scan, restore and security review. See `docs/P3_S3_STORAGE_RUNBOOK.md` and `docs/ENV_REQUIRED.md`.

**Do not assume that a manually approved slip proves receipt of money.** Ledger postings are manually reviewed only; invoice status remains ISSUED. Do not send real bank transactions or auto-mark PAID.



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
corepack pnpm --filter @apartment/api smoke:s3
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
