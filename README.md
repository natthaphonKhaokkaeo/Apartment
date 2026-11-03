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
