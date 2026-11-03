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
