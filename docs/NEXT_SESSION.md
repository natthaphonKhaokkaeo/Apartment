# Apartment — START HERE (new coding session)

**Canonical progress plan:** [PHASES.md](PHASES.md). Read it before editing or estimating status.

## Mission

Continue the Apartment LINE-first multi-tenant SaaS in `/root/Projects/Apartment`.

**Start with P3-02b / P3-05** after confirming tests, and read `docs/ENV_REQUIRED.md`. P3-01a owner payment settings, P3-02a DEV private sanitized images, P3-03 owner manual payment review / ledger and P3-04a outstanding/aging are implemented locally. The whole P3 is **NOT complete**: real object storage with signed/quarantined upload, malware scanning/retention, PromptPay QR verification, refunds and official receipts remain pending. If cloud provider keys are not available, work on legal/receipt specification and security/test coverage without prematurely enabling production.

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
- `docs/ENV_REQUIRED.md`: keys needed now (LINE Login) and future-only LINE OA/object-store keys.
- `apps/api/src/routes/payments.ts`: banking instructions, tenant evidence claims, owner manual reviews, ledger.
- `apps/api/src/services/evidence.ts`: DEV-only sanitized WebP private storage.
- `apps/api/src/services/payment-rules.ts`: integer satang, overpayment reject and reference rules.
- `apps/api/scripts/smoke-payment-concurrency.ts`: invoice lock and one-winner owner review.
- `apps/web/src/components/PaymentCenter.tsx`, `TenantPayments.tsx`: owner and tenant payment screens.

## P2 state / known blockers

- Locally implemented and verified: invite+approval+read-only tenant portal and database migration, unit tests, actual Postgres/HTTP smoke. Invoice visibility only **after** owner approval.
- Not verified: actual LINE Developers sandbox login + LIFF integration + external HTTPS, visual browser E2E. The local HTTP smoke uses temporary DB sessions and is **not** real LINE E2E.
- P3 has DEV-only payment Ledger, sanitized image uploads and owner manual review. Still **no actual bank API, external payment settlement confirmation, S3 signed URLs, receipts, PromptPay QR, or background jobs**.
- For Figma creation the user still needs to select a workspace/team; do not assume the organization's team.

## End-of-session policy

Before declaring phase work complete, run tests/typecheck/build/database smoke, document verified evidence and any blocked work. Update both `docs/PHASES.md` (canonical) and `docs/implementation-status.md` (summary). Commit only your finished code with no secrets, no remote push/deploy without authorization. Never use bypass flags or rewrite someone else's changes.
