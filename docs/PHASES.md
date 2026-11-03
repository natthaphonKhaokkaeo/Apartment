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

- **Current phase:** P1-05 verification gates (IN PROGRESS). P1-04 DEV property-scoped staff authorization, 24h token invite/claim/OWNER approval/revoke, dedicated OWNER staff UI and STAFF room/meter UI are implemented and verified in code + real PostgreSQL/HTTP. P1-03c meter continuity and MOVE_OUT partial remain DEV complete; legal evidence/deposit acceptance OPEN.
- **Immediate task:** finish P1-05 with PostgreSQL HTTP/concurrency verification; its implementation is committed and pushed as c0dedbc but not deployed. P1-01b/P5-02 maintenance ticket and room-state code is now in progress with generated migration 0016; it also needs backup, DB/HTTP and browser verification before rollout. Deposit workflows and LINE Login/LIFF remain gated on policy/provider acceptance. Keep LINE outbound disabled.
- **Last verified:** source commit `c0dedbc` is pushed to `origin/main`; deployed baseline remains P1-04 commit `d259c94`. Domain tests 11/11, API tests 73/73 excluding the loopback-dependent malware scanner suite, monorepo typecheck, and Web production build pass here. Full unit run has 2 malware scanner integration failures because the sandbox denies loopback binds (`EPERM`). P1-05 HTTP smoke fails its API readiness check in this sandbox; P5 maintenance HTTP smoke was not run because the same private runtime is unavailable; Docker socket access is denied, so no PostgreSQL HTTP or load result is claimed. P5 maintenance API/UI and migration 0016 remain uncommitted and unapplied. Deployment was not triggered. SHA-256 verified PostgreSQL backup then migration 0015 applied on the VPS; API/Web/LINE Observer were previously healthy internally at 127.0.0.1:18089. Public HTTPS unavailable after VPS reboot (shared Traefik exited 255).

- **Deployment:** Apartment DEV containers are healthy **internally** (Dokploy Compose, 127.0.0.1:18089, not Production). Public https://apartme.makemarket.space is **DOWN after 2026-11-03 reboot**: `dokploy-traefik` Exited (255), no host 80/443 listeners. ACME storage inside shared Traefik remains mounted read-only and logs certificate persistence errors. Do not restart shared Traefik from Apartment maintenance; coordinate separate safe infra recovery of ACME storage/certificates and other domains before public verification. Separate PostgreSQL and other service containers were not changed.
- **Git:** Preserve user files, check `git status --short` before edits; commit with evidence; push/deploy only when explicitly authorized. `c0dedbc` is pushed; it is not deployed. A `.serena/` user directory remains untracked and untouched. Last completed commit: see `git log -1 --oneline`.

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
- [ ] P1-01 Room move-out, maintenance and lease lifecycle transitions (PARTIAL)
  - [x] P1-01a Strict owner-only move-out with final meter/invoice settlement guards, no pending claims/finance, room released AVAILABLE or MAINTENANCE, revoked invitations/consents/outbox, audited lease ENDED, real DB/HTTP security tests, Owner UI
  - [ ] P1-01b Repair/maintenance ticket workflow and room return-from-maintenance, deposit settlement, former-tenant records access and mid-cycle lease transitions (PARTIAL DEV; P1-03 / P5)
    - [x] Tenant/owner maintenance ticket API and UI, ordered status/audit rules, due-time tracking, maintenance-room return gate; migration 0016 generated and pure workflow tests pass. Details in docs/P5_MAINTENANCE_TICKETS.md.
    - [ ] Apply migration only after checksum-verified backup; PostgreSQL tenant/owner/outsider and room-return HTTP smoke; browser acceptance
    - [ ] Deposit/refund policy and workflow, former-tenant invoice/record access policy, mid-cycle lease transition rules
- [x] P1-02 Property Master effective-dated rate history, owner authorization, audit and immutable invoice rate snapshots (DEV)
  - [x] Migration 0012 backfills historical master baseline and seeds new properties
  - [x] OWNER-only future full-period rates, legal tariff ceiling and already-issued invoice guards
  - [x] As-of billing-period rate selection, immutable line snapshot IDs and rate-history Settings UI
  - [ ] Formal tenant legal notices and future scheduled-rate correction policy (Production acceptance)
- [ ] P1-03 Active-rate validity for partial leases, mid-cycle adjustments, meter replacement (PARTIAL — DEV)
  - [x] P1-03a Effective-dated room override versions (migration 0013), owner-only full-period schedule, room/current read models, historical billing snapshots and audit
  - [x] P1-03b Explicit MOVE_IN partial billing from actual lease start to canonical period end, prorated rent with real boundary meters, overlap/idempotency guards and UI
  - [x] P1-03c.1 Meter replacement records (0014), old closing/new opening, serial continuity, owner-only audit, segment-aware reading validation and immutable invoice usage snapshots
  - [x] P1-03c.2 Strict final MOVE_OUT partial invoice; actual boundary meters/usage, prorated rent, no overlap, then separate settled-invoice lease closure
  - [ ] P1-03c.3 Legal meter evidence verification, tenant notices, deposit/refund/credit settlement and Production financial-security acceptance
- [x] P1-04 DEV property-level STAFF grants (VIEWER/METER_READER), OWNER-only invite/claim/approve/revoke, manager-denied member management, safe staff property/room listings, auth-scope + in-TX meter grant locks, auditable flows, owner/staff React screens, 0015 migration, real PostgreSQL/HTTP replay/race/IDOR tests
  - [ ] Real LINE Login/LIFF user acceptance, independent security/load QA and worker operational signoff (P2/P7; not Production-ready). See `docs/P1_STAFF_ACCESS.md`
- [ ] P1-05 Negative-amount/overflow/duplicate/concurrency verification gates under load (**IN PROGRESS**)
  - [x] Invoice line/total and `units_milli` PostgreSQL INTEGER bounds; utility arithmetic overflow returns 422; six focused unit cases pass
  - [x] Isolated DEV HTTP smoke script covers negative/fractional/over-limit input, duplicate reading, cross-org access, 16-way same-key replay, 16-way distinct-key issue race, and a bounded 32-way bill-preview burst (76 total HTTP requests)
  - [ ] Execute smoke against private PostgreSQL/HTTP runtime and record successful response set + latency; run a larger bounded load profile before acceptance
  - **Current verification blocker:** this workspace's sandbox denies API loopback readiness and Docker socket access. Do not count a script that fails readiness as DEV evidence.
- **Gate:** owner cannot access another organization's property, lease, or invoice; previously issued bill never changes.

## Phase P2 — Tenant onboarding & read-only LIFF portal (IMPLEMENTED LOCALLY; LINE E2E BLOCKED)

- [x] P2-01 Owner generates single-use lease invite: random unguessable token, SHA-256 hash in DB, expiry, revoke superseded tokens, no plaintext at rest
- [x] P2-02 Authenticated tenant claims invite atomically into pending state (NO bill access); owner manually approves verified LINE account before linking lease
- [x] P2-03 Tenant only sees own leases, property/room summaries, issued bills and immutable line items; no IDOR / organization leaks
- [x] P2-04 Mobile LIFF-capable tenant view + owner invite/approve UI (build verified, real LINE/browser E2E pending); clean empty/error states and copyable invitation flow
- [x] P2-05 Tests for expired/replaced/replayed invites, one-winner concurrent claims, owner approval, unrelated tenant IDOR, disabled user/session/organization + real Postgres/HTTP smoke
- [ ] P2-06 LINE sandbox E2E with real channel and linked test user (**BLOCKED:** LINE Channel ID + LIFF ID + HTTPS origin). Browser E2E of LIFF flow pending.
- **Gate:** an unapproved LINE account cannot access tenant bills; replayed/expired/revoked invites rejected. A stolen *unused* invite may be claimed but requires explicit owner review/approval before any tenant information is disclosed. Owner must verify claimant identity before approving.

## Phase P3 — Payment & settlement (PARTIAL — DEV IMPLEMENTED, NO BANK API / PRODUCTION OBJECT STORAGE)

- [ ] P3-01 Payment instructions per property: bank and PromptPay fields implemented, **QR generation deferred**
  - [x] P3-01a Owner/Super Admin-only bank settings with optimistic CAS, audit, property scope, disabled state and tenant invoice-bound read
  - [ ] P3-01b PromptPay QR core implemented, real bank-app interoperability/recipient-registration check PENDING
  - [x] P3-01b.1 BOT merchant-presented EMV Tag 29/54/63 builder, 10-digit mobile or 13-digit tax/national ID input, integer-satang amount, published golden CRC vector
  - [x] P3-01b.2 Owner and authorized tenant invoice-scoped no-store APIs, direct browser QR rendering, masked ID, copy/save/refresh UX, prevent QR on zero-balance or pending-payment claim, unit + real HTTP IDOR/partial balance tests
  - [ ] P3-01b.3 **BLOCKED on hands-on confirmation:** scan with real bank apps and confirm actual registered recipient name, fixed amount and LIFF/mobile behavior; no bank settlement verification
- [ ] P3-02 Tenant submits evidence securely; **DEV local private evidence implemented**, S3/presigned upload pending
  - [x] P3-02a Authenticated multipart evidence upload with <4 MB, JPEG/PNG/WebP decoder, 12MP limit, EXIF-stripped WebP re-encode, private files 0600, directory 0700, authorized download and rate limit
  - [ ] P3-02b Signed private S3-compatible evidence storage (PARTIAL; live provider/security gate pending)
  - [x] P3-02b.1 AWS SDK v3 S3 adapter, ENV validation, signed 5-minute quarantine PUT (bound size, SHA-256 checksum), HEAD, bounded GET, signed ticket state
  - [x] P3-02b.2 Backend decode, ≤12MP sanitation, metadata-stripped WebP, separate private key, original quarantine cleanup
  - [x] P3-02b.3 Tenant LIFF chooses S3 direct workflow when enabled; single-use READY→CLAIMED ticket bound to verified tenant/invoice with transactional idempotent payment claim
  - [x] P3-02b.4 Real PostgreSQL + local HTTP S3 **mock** test (SigV4 URL shape, checksum mismatch, replay, tenant IDOR, one-time claim and authorized private read); no external keys required
  - [ ] P3-02b.5 **BLOCKED:** live provider IAM/signature/CORS validation with real credentials + HTTPS endpoint, object policy and permitted origins
  - [ ] P3-02b.6 Safe evidence expiry/cleanup and malware scanning (PARTIAL — Production acceptance pending)
    - [x] P3-02b.6a Migration 0007: legal_hold, EXPIRED, expired_at, cleaned_at; dry-run default, explicit org/confirmation apply; expiry grace, row lock, payment claim reference protection and retry
    - [x] P3-02b.6b Isolated PostgreSQL smoke: dry-run, expired ticket, retained legal hold/CLAIMED/referenced evidence and failed-delete retry
    - [x] P3-02b.6c ClamAV TCP INSTREAM adapter: optional DEV, source+sanitized image scans, mock daemon clean/infected/error/timeout/connection refusal tests, fail-closed when enabled
    - [ ] P3-02b.6d Live clamd EICAR/signature update, S3 lifecycle and restore proof, admin legal retention workflow, worker scheduling, metrics, production security QA
  - [x] P3-02c Production startup fails until production evidence/security hardening is implemented
- [x] P3-03 Owner-only manual review/approve/reject with transaction, transfer-reference unique per property, idempotency key, partial payments and overpayment **rejection**
  - [ ] P3-03b Overpayment credit / refund / dispute policy and workflow; automatic bank verification not implemented
- [ ] P3-04 Ledger and receivables reporting (**partial**)
  - [x] P3-04a Append-only payment Ledger created transactionally with approval, immutable invoice still ISSUED, outstanding and manual-approved totals, overdue counts and aging amounts on Dashboard
  - [ ] P3-04b Financial corrections / refunds / disputes (PARTIAL, legal/bank gates pending)
  - [x] P3-04b.1 Internal credit and manual payment record reversal: append-only entries, original payment Ledger immutable, invoice lock, one original reversal, same-property authorization
  - [x] P3-04b.2 Two-owner workflow: distinct active OWNER request/review; MANAGER rejected; status/idempotency/audit, client request/review UI
  - [x] P3-04b.3 Review-only refund/dispute requests, no cash payouts, no bank-verified settlement; balance reporting separates net manual payments and internal credits
  - [ ] P3-04b.4 Actual refund/chargeback, statutory credit note/tax compliance, reconciliation, dispute evidence & audit sign-off
- [ ] P3-05 Invoice/receipt PDFs and document compliance (PARTIAL: specification only)
  - [x] P3-05a Document type / snapshot / numbering / issuer / access-control / Thai glyph acceptance criteria in `docs/P3_PDF_RECEIPT_SPEC.md`
  - [x] P3-05b Non-tax Billing Notice PDF from immutable amount/lines + issuance-time issuer/property/tenant/room snapshot; Thai font embedded from npm, A4 / multi-page footer, explicit **NOT receipt/tax** banner, owner/tenant authorized download, HTTP IDOR and legacy fallback tests
  - [ ] P3-05c Official receipts, tax invoices and VAT/issuer/retention/legal approval
- [x] P3-06 DEV tenant-IDOR/manager-denial, replay/version-CAS, private evidence, payment status, partial/full/overpay and concurrent-owner approvals HTTP tests
  - [ ] P3-06b Real bank reconciliation E2E, S3 signed-upload E2E, browser/LIFF and production performance/load gates
- **Gate:** no implicit bank payment confirmation. Only recorded **manual owner-reviewed** approvals enter Ledger; immutable invoices remain ISSUED. Production launch needs bank verification policy, legal receipts, cloud evidence storage and security QA.

## Phase P4 — LINE OA integration (IN PROGRESS — DEV)

- [x] P4-01 Provisional one LINE OA per organization (multiple properties), unique org/destination binding, admin-only controlled registration, no secrets in DB
- [x] P4-02 Signed raw-body webhook (HMAC-SHA256 constant-time), 256KiB limit, rate limit, 100-event bound, destination check, atomic event dedupe, no raw PII persistence
- [ ] P4-03 Durable outbox, worker and LINE delivery (PARTIAL; live worker/scheduler pending)
  - [x] P4-03a Consent-bound transactional enqueue, stable idempotency/retry key, PostgreSQL SKIP LOCKED worker claim, exponential retry, DEAD/SIMULATED/ACCEPTED states, 23-hour retry-key safety guard
  - [x] P4-03b Real PostgreSQL mock HTTP/outbox tests: valid signature, duplicate delivery, consent revoked, simulated no-send, 429 retry, stable retry key, received status
  - [ ] P4-03c Monitoring/worker operations (PARTIAL — provider/live gate pending)
    - [x] P4-03c.1 Scoped, sanitized Super Admin counters + Dead-letter list, one-time review and audit, migration 0010
    - [x] P4-03c.2 Separate continuous observe-only DEV worker with heartbeat health, 60-second poll, no public port, fail-closed live gate
    - [x] P4-03c.3 TDD unit and real PostgreSQL HTTP tests for role/scope/PII/duplicate review/immutable terminal status
    - [x] P4-03d.1 Durable per-org/global rolling 60-second attempt reservations with cross-worker PostgreSQL advisory transaction lock, bounded ENV quotas and least-used-org selection
    - [x] P4-03d.2 Durable internal incident episodes (Dead-letter unreviewed / expired Sending / queue backlog), duplicate-suppression, auto-resolution, admin acknowledgment and masked UI
    - [x] P4-03d.3 Pure TDD fairness/threshold tests + real PostgreSQL concurrent mock-sender quota and admin incident lifecycle HTTP smoke
    - [ ] P4-03d.4 Real provider quota calibration, multi-channel fairness, external incident paging, production live sender acceptance
    - [x] P4-03e.1 Consent revoke/dispatch race serialization with consistent lease/OA/consent lock order, real mock HTTP concurrency proof; messages already in flight are NOT recallable
    - [x] P4-03e.2 Per-org 30-day min reservation retention, manual dry-run by default and bounded confirmed cleanup with PostgreSQL integration test
    - [ ] P4-03e.3 Alert delivery/retention legal policy, real LINE provider quota, live in-flight uncertainty testing and offsite backup
- [ ] P4-04 Tenant consent and notification event producers (PARTIAL — real provider and future workflows pending)
  - [x] P4-04a Tenant-specific opt-in/revoke endpoints and React UI with explicit purpose acknowledgment, active verified LINE lease scope, audit, idempotent actions, no-store, revoke pending/retry/SENDING jobs
  - [x] P4-04b Invoice-issued Outbox event created atomically with invoice transaction only on active lease + enabled OA + unrevoked exact recipient consent; generic Thai template and eventKey prevent duplicates
  - [x] P4-04c Manual due-date Outbox preparation with Bangkok-day guard, org-scoped dry-run default, explicit confirmation for enqueue, payment/outstanding/pending-claim guards; never sends LINE itself
  - [ ] P4-04d Real LINE Messaging API/LIFF validation and consent policy, invitation and repair event producers (not yet eligible: P5 maintenance and safe invitation contact proof), operator monitoring/scheduling
- [ ] P4-05 LIFF callback/login/logout/tenant invitation with actual LINE sandbox E2E
- **Gate:** no outbound notification without legitimate recipient/consent; retries never double-send from application logic.

- P4-01/02/03 DEV code and tests: see \`docs/P4_LINE_OA_WEBHOOK_OUTBOX.md\`. LIVE sender and consent/notification UX remain blocked.

## Phase P5 — Full property operations (PARTIAL — DEV)

- [ ] P5-01 Monthly and 15-day scheduled bulk invoices (preview → approval → batch process)
- [ ] P5-02 Maintenance tickets and room status workflow; files, notifications, SLA (IN PROGRESS — partial DEV)
  - [x] Tenant/owner tickets, workflow states, audit, due-time/overdue display, room MAINTENANCE entry and guarded return; migration 0016 and service tests. See docs/P5_MAINTENANCE_TICKETS.md.
  - [ ] PostgreSQL authorization/lifecycle smoke, migration rollout, browser QA, private files, SLA policy/reports, consent-bound notifications and independent review
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
- 2026-11-03 P3: `corepack pnpm test` — 11 domain + 19 API tests, `corepack pnpm typecheck` + web build.
- 2026-11-03 P3: `corepack pnpm --filter @apartment/api smoke:http` bank update CAS, tenant-only bank view, manager denied, private sanitized evidence, review/reject, partial+full, replay and 422 overpay passed.
- 2026-11-03 P3: `corepack pnpm --filter @apartment/api smoke:payments` concurrent decisions produce one APPROVE and one 422, ledger amount correct; rate limit responds 429.
- 2026-11-03 P3 S3: Drizzle migration 0005 added evidence_uploads state (INITIATED/PROCESSING/READY/CLAIMED/FAILED); 16 DEV tables.
- 2026-11-03 P3-05b: Drizzle migration 0006 adds invoice document_snapshot and line ordinal for new invoices; old invoices flagged CURRENT_RECORD_LEGACY.
- 2026-11-03 P3-05b: `corepack pnpm --filter @apartment/api test` PDFJS extraction for Thai/money, 70-line pagination, sum mismatch reject; HTTP smoke owner/tenant 200, outsider 404, unauthenticated 401, cross-org 403, snapshot label immutability and legacy disclosure.
- 2026-11-03 P3-05b: PDF visual rendering verified with `corepack pnpm --filter @apartment/api exec tsx scripts/preview-billing-pdf.ts` plus `--long` (7 pages); **not** a legal receipt or tax invoice.
- 2026-11-03 P3 S3: 32 unit tests (11 domain + 21 API); `corepack pnpm --filter @apartment/api smoke:s3` uses local HTTP mock, checksum and tenant IDOR, real Postgres; **NOT real S3 provider IAM/CORS**.
- Storage threat model and provider CORS/lifecycle runbook: `docs/P3_S3_STORAGE_RUNBOOK.md`; legal document requirements: `docs/P3_PDF_RECEIPT_SPEC.md`.
- 2026-11-03 P3-01b: BOT/EMV merchant-presented PromptPay QR built locally; CRC golden BB8A for 0812345678/THB 100, 5 new API unit tests; owner/tenant 200, invalid 400, outsider 404, cross-property 403, disabled 404, pending/full 409, partial-balance update verified with DEV Postgres HTTP smoke. Bank-app recipient confirmation remains outstanding; see `docs/P3_PROMPTPAY_QR.md`.
- Environment variables/keys: `docs/ENV_REQUIRED.md`. No real gateway, actual LINE OA or object storage credentials configured.
- Keep `docs/implementation-status.md` as a short mirror; **this PHASES file supersedes its checklist**.

## NEXT SESSION START HERE (paste this to a new agent)

You are continuing the Apartment SaaS project on **/root/Projects/Apartment** (DEV only). Before coding:
1. Read `AGENTS.md`, `README.md`, and **`docs/PHASES.md`**, especially *Current checkpoint* and the first unchecked item in the active phase.
2. Check `git status --short --branch` and `git log -1 --oneline`; preserve all user work. Current active item is **P1-05**, not P4-01. Its implementation and bounded smoke script may already be in progress; inspect before editing.
3. Complete `apps/api` P1-05 with the real PostgreSQL HTTP/concurrency smoke and an appropriate load run. Do not mark it complete from unit tests alone. If the DEV database/runtime is unavailable, record the exact blocker and leave it pending.
4. Run `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm --filter @apartment/web build`, and the API PostgreSQL smoke suites when their required local services are available. A restricted sandbox may reject loopback tests; distinguish that from product test failures.
5. Update this file's current checkpoint and verification evidence. Continue with P1-01b/P5 work after P1-05. Keep real LINE, bank, S3 provider, legal, security, offsite backup, and Production acceptance gates pending until verified with the required external inputs. Never mark an invoice PAID automatically.
6. If external secrets or a product decision are required, leave that specific checkbox blocked and continue other independent work.

## Decisions required (do not block local coding)

- One LINE OA per org **provisional**, or one per property?
- Rent in advance vs in arrears; default billing due date, partial month handling
- Receipt/tax invoice identity and regulation review with authorized expert
- Legal admissibility of water/electric tariff values and proof for each property
- Figma target plan selection
- P3 evidence provider and storage keys; PromptPay QR reference standard, refund/credit policy, official receipt identity

- P3-02b.6 DEV: migration 0007, ClamAV INSTREAM fake TCP tests, and PostgreSQL fixture cleanup smoke completed. No real evidence deleted. Read docs/P3_EVIDENCE_RETENTION_MALWARE.md.
