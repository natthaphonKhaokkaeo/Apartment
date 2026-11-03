# Apartment — LINE-first Apartment Management SaaS
Status: DEV MVP under active implementation (not production ready).

## Structure
- apps/api — Fastify 5, TypeScript, Drizzle ORM, PostgreSQL.
- apps/web — React 19, Vite, LIFF, mobile-first Thai UI.
- packages/domain — deterministic calendar and billing algorithms.
- infra — loopback-only PostgreSQL development Compose.
- docs/implementation-status.md — live checkpoints and outstanding features.

## Implemented
LINE ID-token verification and hashed HttpOnly sessions; account/organization scope, properties, rooms and per-room rate overrides, leases, monotonic meter readings; bill preview, transactional/idempotent invoice issue; Super Admin tariff compliance review; overview, room, meter and billing frontend.

## Setup (DEV)
1. Node 22+, Corepack/pnpm 12.
2. Copy .env.example to .env and set APARTMENT_DB_PASSWORD, DATABASE_URL, LINE_CHANNEL_ID, WEB_ORIGIN, secure cookie settings. VITE_LIFF_ID in apps/web/.env.
3. docker compose --env-file .env -f infra/compose.dev.yaml up -d
4. corepack pnpm install && corepack pnpm db:migrate
5. In separate terminals corepack pnpm dev:api and corepack pnpm dev:web.
6. Register correct HTTPS LIFF URL in LINE Developers before real LINE OA access.

Never expose dev DB, use dummy credentials in production, assume the public preview receives payments, or use real charges before legal review.
Testing: corepack pnpm test; corepack pnpm typecheck; corepack pnpm --filter @apartment/web build.

## Runtime verification
Run corepack pnpm --filter @apartment/api smoke and corepack pnpm --filter @apartment/api smoke:http with the private development DB running. HTTP smoke creates temporary isolated owners/properties, tests 403/201/200 replay/409 and cleans its fixtures.

## Canonical phase plan / new session handoff
See [docs/PHASES.md](docs/PHASES.md) for all checkboxes, validation gates, and exact next-task instructions.

## P2 Tenant Portal (local implementation)
- Owner: "/v1/properties/:propertyId/leases/:leaseId/invitations" (POST/GET), owner approve or revoke specific claimed invitation.
- Tenant (authenticated via LINE-backed session): POST "/v1/tenant/invitations/claim" creates **pending owner approval**; tenant GET "/v1/tenant/leases", "/v1/tenant/invoices", and "/v1/tenant/invoices/:invoiceId" only after approval.
- Tokens: random 256-bit 24h expiry, hash at rest, only one claim; owner review before account activation, rate-limited claim route. Do not share tokens in URLs, logs or analytics.
- React menu: "เชิญผู้เช่า" for owner; "สำหรับผู้เช่า" for read-only tenant. LINE LIFF E2E requires actual LINE Developers credentials and HTTPS.

For current status and the next task, read the canonical [docs/PHASES.md](docs/PHASES.md). `docs/NEXT_SESSION.md` is a historical implementation log; it may contain older checkpoints.

## P3 DEV payments

Owner endpoints: GET/PUT `/v1/properties/:propertyId/payment-instructions`, GET `/v1/properties/:propertyId/payment-claims`, POST `/v1/properties/:propertyId/payment-claims/:claimId/decision`. Owner or Super Admin may edit account settings and decide claims.

Tenant endpoints: GET `/v1/tenant/invoices/:invoiceId/payment-instructions`, POST multipart `/v1/tenant/invoices/:invoiceId/payment-claims` with idempotency-key header, GET own claims and payment summary. Evidence can be read only via authorized endpoints.

Private evidence is stored as sanitized WebP in a non-public DEV-only directory; `PAYMENT_EVIDENCE_DIR` is optional. Production startup is intentionally blocked. No bank verification, receipt PDFs, refunds, external payment APIs or signed object-store uploads yet.

Additional concurrency test: `corepack pnpm --filter @apartment/api smoke:payments`. ENV checklist: [docs/ENV_REQUIRED.md](docs/ENV_REQUIRED.md).


## P3 signed S3-compatible upload (code completed, real credentials pending)
- `EVIDENCE_STORAGE_DRIVER=local`: existing Fastify multipart flow remains available on private DEV storage.
- `EVIDENCE_STORAGE_DRIVER=s3`: client requests 5-min quarantine PUT URL, uploads with checksum and content length, backend verifies and decodes to private WebP, then links one-time ticket to payment claim. See `docs/P3_S3_STORAGE_RUNBOOK.md`.
- `corepack pnpm --filter @apartment/api smoke:s3` runs HTTP S3 mock and actual PostgreSQL workflow without remote keys.
- **Do not confuse S3 mock tests with real S3/provider E2E.** Production remains disabled while malware scan / lifecycle / real provider IAM-CORS tests are outstanding.
- A non-tax Billing Notice PDF is implemented; official receipt/tax invoice requirements remain pending legal approval. See `docs/P3_PDF_RECEIPT_SPEC.md`.


## P3-05b Thai Billing Notice (not receipt / not tax invoice)
Authorized PDF download: GET /v1/properties/:propertyId/invoices/:invoiceId/billing-notice.pdf or GET /v1/tenant/invoices/:invoiceId/billing-notice.pdf.
The React owner and tenant screens expose download links. New bills snapshot issuer/property/address/room/tenant data at issue time; old bills disclose current-record fallback. All currency totals are taken from existing immutable invoice_lines, never recalculated from current Master pricing.
PDFKit embeds Noto Sans Thai from @expo-google-fonts/noto-sans-thai; no additional ENV, API key, or font file to supply. Visual QA: corepack pnpm --filter @apartment/api exec tsx scripts/preview-billing-pdf.ts (add --long for 7-page test). See docs/P3_PDF_RECEIPT_SPEC.md.


## P3-01b PromptPay QR (DEV)
Owner/tenant invoice-scoped endpoints: `GET /v1/properties/:propertyId/invoices/:invoiceId/promptpay-qr` and `GET /v1/tenant/invoices/:invoiceId/promptpay-qr`. PromptPay ID must be a Thai mobile (10 digits, 06/08/09) or 13-digit tax/national ID set by owner in Property Payment Settings; no other ENV required. API encodes BOT/EMV Tag 29/54/63 with integer-satang outstanding and returns no-store display-only payload. Web uses a local `qrcode` library to render pixels; it does not send IDs to a third party. QR disappears while a payment claim is pending or when the manually recorded balance is zero. It does **not** verify recipient registration or bank settlement. Real bank app scan is still a required acceptance gate. See docs/P3_PROMPTPAY_QR.md.

## P3-02b.6 DEV orphan evidence cleanup / optional ClamAV
See docs/P3_EVIDENCE_RETENTION_MALWARE.md. Manual CLI defaults to read-only: corepack pnpm --filter @apartment/api evidence:cleanup. Deletion requires --apply --confirm-orphans-only --organization-id=<UUID> and must not run against production until legal/storage acceptance. Real PostgreSQL smoke: corepack pnpm --filter @apartment/api smoke:cleanup. ClamAV is optional and disabled in DEV; disabling does NOT imply clean.

## DEV Docker deployment and P3-04b finance
Source git@github.com:natthaphonKhaokkaeo/Apartment.git. The Dokploy-managed DEV Compose binds the Web container to VPS loopback `127.0.0.1:18089` and reuses the existing PostgreSQL service. Deployment and current availability are tracked in `docs/DEPLOY_DOKPLOY_DEV.md`.

Finance workflow adds internal credits, append-only manual payment reversals, and review-only refund/dispute requests with dual OWNER approval and audit. No real transfers or statutory credit notes. Test: corepack pnpm --filter @apartment/api smoke:finance. Details: docs/P3_FINANCIAL_ADJUSTMENTS.md.
## P4 LINE OA (DEV code, not live)

Signed raw-body webhook: POST `/v1/line/oa/webhook` (requires LINE Messaging secret and enabled owner org binding). Deduped event storage, explicit consent-bound durable outbox with retry/dead state, and an observe-only worker are implemented. Real credentials are not configured and outbound sending remains disabled. See `docs/P4_LINE_OA_WEBHOOK_OUTBOX.md`.
## Dokploy DEV

Apartment DEV uses Dokploy Compose: Project Apartment / environment dev / Compose Apartment DEV. The Web port is bound to `127.0.0.1:18089`. Latest recorded internal checks show healthy services; public HTTPS currently responds. Shared Traefik ACME persistence and renewal remain unverified. See `docs/DEPLOY_DOKPLOY_DEV.md`.

## Public Apartment DEV
URL: https://apartme.makemarket.space (DEV only). Public access currently works; shared Traefik/ACME persistence and renewal recovery remain pending. Real LINE Login remains unconfigured. See `docs/DEPLOY_DOKPLOY_DEV.md`.

## P4-04 LINE tenant consent and bill notifications (DEV)
Authenticated tenants can explicitly opt into/revoke notification messages for each active linked lease. Invoice issuance queues a generic privacy-safe BILL_ISSUED Outbox event atomically only with consent; otherwise it issues normally without LINE. Manual, org-scoped due-date reminders queue through line:prepare-due with dry-run default and require --apply --confirm-queue-only for actual Outbox insertion (still **no message is sent**). Live LINE outbound remains disabled pending real credentials, LINE sandbox and privacy review. See docs/P4_TENANT_CONSENT_NOTIFICATIONS.md.

## P4-03c LINE Outbox operations (DEV)
The Dokploy Compose service line-observer continuously monitors aggregate queue health with heartbeat (no sending). Platform Super Admin can read scoped counts and masked Dead-letters and acknowledge once (no retry). LIVE LINE dispatch remains disabled. See docs/P4_LINE_OPERATIONS.md.

## P4-03d safe LINE quotas and internal incidents
The observe-only Dokploy worker now tracks durable internal incidents; admin dashboard shows per-org quota window usage and alerts. A future live dispatcher uses PostgreSQL-serialized global/per-org attempt quotas and least-used-org fairness, verified with mock sender. There are NO real LINE sends or external incident notifications. See docs/P4_LINE_QUOTAS_ALERTS.md.

## PostgreSQL backup (Apartment DEV)
The PostgreSQL data is in a persistent Docker named volume and is also now backed up daily at 03:30 Asia/Bangkok via apartment-postgres-backup.timer. Root-only local backups are retained 14 days and verified by SHA-256; a real isolated temporary PostgreSQL restore was tested. **No offsite copy yet**, so complete offsite replication before Production. Runbook: docs/POSTGRES_BACKUP_RESTORE.md.

## P4-03e LINE safety
LINE worker now serializes new LIVE send starts with tenant consent revocation using DB row locks. Existing in-flight messages are not recallable. Per-organization reservation retention cleanup is manual and DRY_RUN by default with >=30 day cutoff. Actual LINE outbound remains disabled in DEV. See docs/P4_LINE_RETENTION.md.

## P1-01a Owner move-out (DEV)
The Rooms owner UI now provides a strict move-out operation (POST /v1/properties/:propertyId/leases/:leaseId/move-out) that checks final water/electric meter readings, final invoice period, no pending payment/financial reviews, and zero outstanding across all issued invoices. It updates the room to AVAILABLE or MAINTENANCE, ends the lease, revokes future invitations/LINE notifications and audits without changing historical finance records. This is DEV functionality, not official security-deposit or legal move-out settlement. See docs/P1_LEASE_MOVE_OUT.md.

## P1-02 effective-dated Master tariffs (DEV)
Owner Settings supports scheduling property rent, water and electricity rates
for future complete billing periods. Rate history is preserved, and new bills
snapshot the selected version without repricing old invoices. Migration 0012
seeds existing and new property baselines. See docs/P1_PROPERTY_RATE_HISTORY.md.
Room overrides and midcycle proration remain P1-03.

## P1-03a/b Room rate history and move-in partial invoices (DEV)
Owner Room Settings now schedule rate overrides by effective billing-cycle start;
history and master/override snapshots are retained without repricing old bills.
Billing now offers a guarded MOVE_IN partial invoice, calculated from actual
lease.startDate to the canonical period end and from boundary meter readings.
Overlapping invoices are blocked. Meter replacement and MOVE_OUT partial bills
are implemented for guarded MOVE_IN and MOVE_OUT periods, with meter replacement history. Formal meter evidence, deposit settlement and legal acceptance remain open. See `docs/P1_METER_REPLACEMENT_MOVE_OUT.md`.

## P1-03c Meter swaps and final partial move-out (DEV)
Owner Meter UI records append-only physical replacement events with old/new serial,
closing/opening readings, evidence reference and audit. Billing combines physical
meter segments without double charging and retains event IDs in immutable invoices.
The MOVE_OUT partial billing option prorates final rent to the actual handover day
and requires end-boundary readings. The separate OWNER lease close still requires
all invoices settled and confirmed handover. No deposit refund or certified
meter-evidence upload is automated. See docs/P1_METER_REPLACEMENT_MOVE_OUT.md.

## P5-02 Maintenance tickets (DEV partial)

Tenant repair requests are tied to the tenant's approved active lease; owners/managers can manage property tickets and room maintenance status. Return from MAINTENANCE requires no active lease and every room-linked ticket closed or cancelled. Migration 0016 is generated but has not been applied or verified against the DEV PostgreSQL runtime. Attachments, configurable SLA policy and LINE maintenance notifications remain pending. See docs/P5_MAINTENANCE_TICKETS.md.
