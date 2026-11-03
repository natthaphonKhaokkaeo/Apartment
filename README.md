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

New agent? Read [docs/NEXT_SESSION.md](docs/NEXT_SESSION.md) first, then the canonical [docs/PHASES.md](docs/PHASES.md).

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
- Receipt/tax PDF requirements (not yet implemented): `docs/P3_PDF_RECEIPT_SPEC.md`.


## P3-05b Thai Billing Notice (not receipt / not tax invoice)
Authorized PDF download: GET /v1/properties/:propertyId/invoices/:invoiceId/billing-notice.pdf or GET /v1/tenant/invoices/:invoiceId/billing-notice.pdf.
The React owner and tenant screens expose download links. New bills snapshot issuer/property/address/room/tenant data at issue time; old bills disclose current-record fallback. All currency totals are taken from existing immutable invoice_lines, never recalculated from current Master pricing.
PDFKit embeds Noto Sans Thai from @expo-google-fonts/noto-sans-thai; no additional ENV, API key, or font file to supply. Visual QA: corepack pnpm --filter @apartment/api exec tsx scripts/preview-billing-pdf.ts (add --long for 7-page test). See docs/P3_PDF_RECEIPT_SPEC.md.


## P3-01b PromptPay QR (DEV)
Owner/tenant invoice-scoped endpoints: `GET /v1/properties/:propertyId/invoices/:invoiceId/promptpay-qr` and `GET /v1/tenant/invoices/:invoiceId/promptpay-qr`. PromptPay ID must be a Thai mobile (10 digits, 06/08/09) or 13-digit tax/national ID set by owner in Property Payment Settings; no other ENV required. API encodes BOT/EMV Tag 29/54/63 with integer-satang outstanding and returns no-store display-only payload. Web uses a local `qrcode` library to render pixels; it does not send IDs to a third party. QR disappears while a payment claim is pending or when the manually recorded balance is zero. It does **not** verify recipient registration or bank settlement. Real bank app scan is still a required acceptance gate. See docs/P3_PROMPTPAY_QR.md.

## P3-02b.6 DEV orphan evidence cleanup / optional ClamAV
See docs/P3_EVIDENCE_RETENTION_MALWARE.md. Manual CLI defaults to read-only: corepack pnpm --filter @apartment/api evidence:cleanup. Deletion requires --apply --confirm-orphans-only --organization-id=<UUID> and must not run against production until legal/storage acceptance. Real PostgreSQL smoke: corepack pnpm --filter @apartment/api smoke:cleanup. ClamAV is optional and disabled in DEV; disabling does NOT imply clean.

## DEV Docker deployment and P3-04b finance
Source git@github.com:natthaphonKhaokkaeo/Apartment.git. Docker Compose from docker-compose.dokploy.yml builds DEV API/Web, binds web to VPS loopback 127.0.0.1:18088 and reuses PostgreSQL. **Not yet Dokploy-managed:** Dokploy API refused unauthenticated calls; see docs/DEPLOY_DOKPLOY_DEV.md.

Finance workflow adds internal credits, append-only manual payment reversals, and review-only refund/dispute requests with dual OWNER approval and audit. No real transfers or statutory credit notes. Test: corepack pnpm --filter @apartment/api smoke:finance. Details: docs/P3_FINANCIAL_ADJUSTMENTS.md.
\n## P4 LINE OA (DEV code, not live)\nSigned raw-body webhook: POST /v1/line/oa/webhook (requires LINE Messaging secret and enabled owner org binding). Deduped event storage, explicit consent-bound durable outbox with retry/dead state and one-shot worker script. Real messaging disabled by default; no automatic notifications or public webhook enabled. See docs/P4_LINE_OA_WEBHOOK_OUTBOX.md.\n
## Latest Dokploy DEV (confirmed running)
Apartment DEV is now a Dokploy-managed Compose application: Project Apartment / environment dev / Compose Apartment DEV. The web is private on 127.0.0.1:18089; /readyz 200, unauthenticated API 401, API/Web Healthy. Old temporary loopback port 18088 stack was stopped. No public HTTPS or real LINE keys yet. See docs/DEPLOY_DOKPLOY_DEV.md.

## Public Apartment DEV
URL: https://apartme.makemarket.space (DEV only). Routes through Dokploy Traefik and Nginx with trusted current HTTPS certificate. API readiness and authorization tested. Real LINE Login remains unconfigured; Traefik ACME certificate persistence requires infrastructure repair before relying on automatic renewal. See docs/DEPLOY_DOKPLOY_DEV.md.

## P4-04 LINE tenant consent and bill notifications (DEV)
Authenticated tenants can explicitly opt into/revoke notification messages for each active linked lease. Invoice issuance queues a generic privacy-safe BILL_ISSUED Outbox event atomically only with consent; otherwise it issues normally without LINE. Manual, org-scoped due-date reminders queue through line:prepare-due with dry-run default and require --apply --confirm-queue-only for actual Outbox insertion (still **no message is sent**). Live LINE outbound remains disabled pending real credentials, LINE sandbox and privacy review. See docs/P4_TENANT_CONSENT_NOTIFICATIONS.md.

## P4-03c LINE Outbox operations (DEV)
The Dokploy Compose service line-observer continuously monitors aggregate queue health with heartbeat (no sending). Platform Super Admin can read scoped counts and masked Dead-letters and acknowledge once (no retry). LIVE LINE dispatch remains disabled. See docs/P4_LINE_OPERATIONS.md.
