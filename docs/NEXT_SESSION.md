# Apartment — START HERE (new coding session)

**Canonical progress plan:** [PHASES.md](PHASES.md). Read it before editing or estimating status.

## Mission

Continue the Apartment LINE-first multi-tenant SaaS in `/root/Projects/Apartment`.

**Start with P3-01** after confirming clean branch and completed P2 DEV checks. Implement owner-controlled **display-only** payment instructions scoped to a property: bank name, account name, bank number and optional PromptPay identifier. Do not implement transfers, payment success, settlement, or paid status in P3-01. Treat bank-detail modifications as security-sensitive: OWNER/SUPER_ADMIN only, audit every change, tenant can read only when an approved active lease links their LINE identity. Build tests before code. Keep default empty, no fake real bank details. PromptPay QR and provider/bank verification can be a separately gated follow-up.

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

## P2 state / known blockers

- Locally implemented and verified: invite+approval+read-only tenant portal and database migration, unit tests, actual Postgres/HTTP smoke. Invoice visibility only **after** owner approval.
- Not verified: actual LINE Developers sandbox login + LIFF integration + external HTTPS, visual browser E2E. The local HTTP smoke uses temporary DB sessions and is **not** real LINE E2E.
- No payment ledger, slips, messages, settlement, receipts, PromptPay QR, PDF or background jobs yet.
- For Figma creation the user still needs to select a workspace/team; do not assume the organization's team.

## End-of-session policy

Before declaring phase work complete, run tests/typecheck/build/database smoke, document verified evidence and any blocked work. Update both `docs/PHASES.md` (canonical) and `docs/implementation-status.md` (summary). Commit only your finished code with no secrets, no remote push/deploy without authorization. Never use bypass flags or rewrite someone else's changes.
