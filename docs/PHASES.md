# Apartment SaaS — Master Phase Plan & Session Handoff

> **Source of truth:** this file is canonical. Update checkboxes **only after code + evidence**.
> Repo: `/root/Projects/Apartment` | Branch: `main` | Last baseline commit: `1c785e1` (2026-11-03).
> Environment: DEV ONLY; no production launch, real payment, or outbound LINE messages without authorization.

## Status legend

- `[x]` implemented **and verified** (refer to evidence)
- `[ ]` pending, partial, blocked, or unverified; add `IN PROGRESS` / `BLOCKED` label as needed
- Never mark whole phase DONE while a blocking checklist item remains.
- Always update **Current checkpoint**, **Verification evidence**, and **NEXT SESSION START HERE** before ending a coding session.

## Current checkpoint (live)

- **Current phase:** P3 — Payment instructions and reconciliation design (P2 implemented locally; real LINE sandbox validation remains blocked).
- **Immediate task:** P3-01 implement owner-configured payment instructions as display-only; then P3-02 secure evidence upload design. Never auto-mark paid. P2-06 requires real LINE sandbox credentials/HTTPS to unblock.
- **Last verified:** 22 tests (11 domain + 11 API), API + web typecheck, React production build, real Postgres migrations and HTTP smoke (invoice issue + tenant invitation + cross-tenant access, expiry/replay/revoke, concurrent claims, disabled accounts/org) passed 2026-11-03.
- **Deployment:** Postgres DEV on `127.0.0.1:55432`; API/web not deployed. Actual LINE credentials not configured.
- **Git:** Preserve user files, check `git status --short` before edits; commit with evidence; no push or production deploy without explicit instruction. Last completed commit: see `git log -1 --oneline`.

## Phase P0 — Foundation & database (DONE)

- [x] pnpm monorepo, Node >=22, React 19/Vite and Fastify 5/TypeScript
- [x] PostgreSQL + Drizzle schema and initial SQL migration
- [x] DEV Docker Compose with PostgreSQL bound to loopback
- [x] `.env` ignored; no credentials in repo; session tokens hashed in DB
- [x] Baseline tests, typecheck, browser build, Postgres/HTTP smoke suite
- [ ] CI pipeline on pull request, >=80% meaningful coverage, lint / dependency vulnerability scan (Phase P7)
- **Gate:** baseline build works in isolated DEV and DB migration is reversible without data loss.

## Phase P1 — Multi-tenant owner & billing foundation (PARTIAL)

- [x] LINE ID-token verification on server (real LINE E2E still pending)
- [x] Session revocation, HttpOnly cookie, DB-backed org access control
- [x] Owners can create organization, multiple properties, rooms with per-room overrides
- [x] Lease creation occupies available room atomically
- [x] Meter reading entry, monotonic validations, unique date/room/type
- [x] Monthly / calendar semi-monthly / rolling 15-day billing calculations (satang / milli-units)
- [x] Single-room invoice preview and transaction + idempotency issue
- [x] Snapshot line items + audit events; reviewed tariff ceiling guard
- [x] Responsive owner/dashboard, room, meter, billing UI
- [ ] P1-01 Room move-out, maintenance and lease lifecycle transitions
- [ ] P1-02 Property Master rate update with effective-date history, audit & recalculation rules
- [ ] P1-03 Active-rate validity for partial leases, mid-cycle adjustments, meter replacement
- [ ] P1-04 Property-level staff permissions, org membership invitation/revocation
- [ ] P1-05 Negative-amount/overflow/duplicate/concurrency verification gates under load
- **Gate:** owner cannot access another organization's property, lease, or invoice; previously issued bill never changes.

## Phase P2 — Tenant onboarding & read-only LIFF portal (IMPLEMENTED LOCALLY; LINE E2E BLOCKED)

- [x] P2-01 Owner generates single-use lease invite: random unguessable token, SHA-256 hash in DB, expiry, revoke superseded tokens, no plaintext at rest
- [x] P2-02 Authenticated tenant claims invite atomically into pending state (NO bill access); owner manually approves verified LINE account before linking lease
- [x] P2-03 Tenant only sees own leases, property/room summaries, issued bills and immutable line items; no IDOR / organization leaks
- [x] P2-04 Mobile LIFF-capable tenant view + owner invite/approve UI (build verified, real LINE/browser E2E pending); clean empty/error states and copyable invitation flow
- [x] P2-05 Tests for expired/replaced/replayed invites, one-winner concurrent claims, owner approval, unrelated tenant IDOR, disabled user/session/organization + real Postgres/HTTP smoke
- [ ] P2-06 LINE sandbox E2E with real channel and linked test user (**BLOCKED:** LINE Channel ID + LIFF ID + HTTPS origin). Browser E2E of LIFF flow pending.
- **Gate:** an unapproved LINE account cannot access tenant bills; replayed/expired/revoked invites rejected. A stolen *unused* invite may be claimed but requires explicit owner review/approval before any tenant information is disclosed. Owner must verify claimant identity before approving.

## Phase P3 — Payment & settlement (NOT STARTED)

- [ ] P3-01 Payment instructions per property; minimum data, Bank/PromptPay QR as display only
- [ ] P3-02 Tenant submits payment evidence metadata securely; private object storage + signed upload, image sanitation
- [ ] P3-03 Owner review/approve/reject with transaction, unique reconciliation key, partial payment and overpay
- [ ] P3-04 Ledger, outstanding balance, aging, refunds/adjustments, protected status transitions
- [ ] P3-05 Receipts and PDF tax/document requirements, retention & legal review
- [ ] P3-06 Cross-tenant and replay/concurrent approval tests + audited finance reconciliation
- **Gate:** never mark bill paid without authorized, immutable reconciliation evidence.

## Phase P4 — LINE OA integration (NOT STARTED)

- [ ] P4-01 Choose binding: provisional **one OA per owner org**, multi-property routing
- [ ] P4-02 Webhook with raw-body signature verification; dedupe event IDs, strict request size / queue
- [ ] P4-03 Transactional outbox + background worker, retry, DLQ, throttle and delivery status
- [ ] P4-04 Invite, bill-issued, payment-due and repair notifications with consent and templates
- [ ] P4-05 LIFF callback/login/logout/tenant invitation with actual LINE sandbox E2E
- **Gate:** no outbound notification without legitimate recipient/consent; retries never double-send from application logic.

## Phase P5 — Full property operations (NOT STARTED)

- [ ] P5-01 Monthly and 15-day scheduled bulk invoices (preview → approval → batch process)
- [ ] P5-02 Maintenance tickets and room status workflow; files, notifications, SLA
- [ ] P5-03 Utility meter photo proof; reading anomalies / reset / replacement
- [ ] P5-04 Security deposits, move-out settlement, rent/utility disputes, void/credit notes
- [ ] P5-05 Occupancy and revenue dashboard; exports/reporting with access control
- [ ] P5-06 Contract, tenant profile, privacy retention / data export / deletion workflows
- **Gate:** idempotent bulk runs, reconciliation, audit and proper landlord/tenant privacy separation.

## Phase P6 — Design system & Figma (NOT STARTED)

- [ ] P6-01 Color / typography / spacing tokens and component states documented in Figma
- [ ] P6-02 Mobile owner: dashboard, rooms, meter, billing, tenant list, payment confirmation
- [ ] P6-03 Mobile tenant: onboarding, bill details, payment evidence, repairs, history
- [ ] P6-04 Desktop Super Admin: owner/tenant overview, compliance, audit and support
- [ ] P6-05 WCAG focus, error/empty/loading states, responsive QA at 320px/390px/desktop
- **Blocker:** user must choose target Figma plan: personal team or SKY ICT team.
- **Gate:** editable Figma layers/components match implementation; responsive design QA.

## Phase P7 — Production security, QA & cutover (NOT STARTED)

- [ ] P7-01 Independent security review: CSRF, tenant IDOR, SSRF, auth/session rotation, role revoke
- [ ] P7-02 CI lint, tests, ≥80% meaningful coverage, API integration and Playwright browser E2E
- [ ] P7-03 Multi-tenant isolation tests incl. missing, disabled, suspended membership/lease/property
- [ ] P7-04 Privacy, legal and utility tariff signoff; Thai tenancy, tax/receipt compliance
- [ ] P7-05 Backup/restore proof, migrations with rollback plan, monitoring / alerting
- [ ] P7-06 Secure HTTPS domain, LINE developer callback and Dokploy DEV deployment; smoke
- [ ] P7-07 Performance/load/billing concurrency, owner/tenant UAT; only then prod launch
- **Gate:** prod launch requires security, financial, legal, performance and UAT signoffs.

## Baseline verification evidence (before P2)

- 2026-11-03: `corepack pnpm test` — 11 domain + 8 API unit tests passed
- 2026-11-03: `corepack pnpm typecheck` passed
- 2026-11-03: `corepack pnpm --filter @apartment/web build` passed
- 2026-11-03: `corepack pnpm --filter @apartment/api smoke` passed on real PostgreSQL
- 2026-11-03: `corepack pnpm --filter @apartment/api smoke:http` passed owner 200/403, admin 403, issue 201, replay 200, duplicate 409
- 2026-11-03: Drizzle migrations `0001` + `0002` applied; `lease_invitations` table with hash/expiry/claim/approve/revoke audit state
- 2026-11-03: API unit tests now **11**, domain **11** (22 total), web build passed
- 2026-11-03: Tenant HTTP smoke passed: invite 201, claim 202 without invoice visibility, approve, tenant invoice 200, outsider invoice 404; expired/replaced/replay reject, one-winner concurrent claims, disabled identity/session 401, disabled org hides invoice
- Keep `docs/implementation-status.md` as a short mirror; **this PHASES file supersedes its checklist**.

## NEXT SESSION START HERE (paste this to a new agent)

You are continuing the Apartment SaaS project on **/root/Projects/Apartment** (DEV only). Before coding:
1. Read `AGENTS.md`, `README.md`, and **`docs/PHASES.md`**, especially *Current checkpoint* and the first unchecked item in the active phase.
2. Check `git status --short --branch` and `git log -1 --oneline`. Preserve uncommitted work; do NOT reset, stash, discard, push, deploy or send actual LINE notifications.
3. Inspect targeted source files. Apply test-first behavior for the next unchecked item and reuse existing Fastify/Drizzle conventions. Default scope: **P3-01 display-only payment instructions and P3 design**; do not mark any invoice PAID. Independently run P2-06 only after real LINE sandbox configuration arrives.
4. Run `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm --filter @apartment/web build`, `corepack pnpm --filter @apartment/api smoke`, and `corepack pnpm --filter @apartment/api smoke:http` when the private Postgres DEV container is up.
5. Update this file with exact checkbox evidence, pending risks, next task and git commit. Do not claim real LINE or finance E2E without keys or evidence.
6. If external secrets or a product decision are required, leave that specific checkbox blocked and continue other independent work.

## Decisions required (do not block local coding)

- One LINE OA per org **provisional**, or one per property?
- Rent in advance vs in arrears; default billing due date, partial month handling
- Receipt/tax invoice identity and regulation review with authorized expert
- Legal admissibility of water/electric tariff values and proof for each property
- Figma target plan selection
