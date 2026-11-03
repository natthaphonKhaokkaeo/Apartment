# Apartment — START HERE (new coding session)

**Canonical progress plan:** [PHASES.md](PHASES.md). Read it before editing or estimating status.

## Mission

Continue the Apartment LINE-first multi-tenant SaaS in `/root/Projects/Apartment`.

**Start with P4-05 LINE Login/LIFF and Messaging Sandbox E2E once provider keys are set.** Without keys, continue P4-03c worker operations (manual/scheduled fail-closed, dead-letter monitoring and quotas) or P4-04d owner consent/audit UI, test-first. Never activate live messaging before real consent/privacy and provider validation.

**P3-02b.6 DEV code completed:** manual dry-run-first cleanup with Legal Hold, EXPIRED retry state and no Payment Claim deletion; optional fail-closed ClamAV TCP INSTREAM adapter. Production gating, actual scanner, lifecycle, admin retention and scheduler are still NOT done. Read docs/P3_EVIDENCE_RETENTION_MALWARE.md.

**P3-01b PromptPay QR implemented in DEV:** read `docs/P3_PROMPTPAY_QR.md`. BOT/EMV Tag 29 payload+CRC golden test, tenant and owner scoped API, local browser QR image + refresh/download, fixed outstanding amount and pending/full-payment guards passed. Real bank-app scan / recipient name verification is **not yet done**, so keep the overall P3-01b checkbox pending external sign-off. No payment is marked paid automatically.

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
corepack pnpm --filter @apartment/api smoke:finance
corepack pnpm --filter @apartment/api smoke:s3
corepack pnpm --filter @apartment/api smoke:cleanup
corepack pnpm --filter @apartment/api evidence:cleanup  # DRY RUN ONLY
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


## PromptPay P3-01b source map
- `apps/api/src/services/promptpay.ts` — BOT/EMV credit-transfer Tag 29 builder, CRC16-CCITT-FALSE, phone/tax proxy validation
- `apps/api/src/routes/promptpay.ts` — tenant/owner invoice-scoped no-store display-only payload endpoints
- `apps/api/tests/promptpay.test.ts` — golden vector and invalid identifier/money tests
- `apps/web/src/components/PromptPayQRCode.tsx` — browser-only QR pixels via lazy `qrcode`, download and refresh
- `apps/web/src/components/TenantPayments.tsx`, `PaymentCenter.tsx` — tenant bill and owner invoice preview integrations
- `apps/api/scripts/smoke-http.ts` — real PostgreSQL, identity/IDOR, pending/full and partial payments QR smoke.

P3-02b.6 files: apps/api/src/services/malware-scanner.ts, services/evidence-cleanup.ts, scripts/cleanup-evidence.ts, scripts/smoke-evidence-cleanup.ts, tests/malware-scanner.test.ts, tests/evidence-cleanup.test.ts, apps/api/drizzle/0007_mixed_christian_walker.sql.

## DEV handoff 2026-11-03
- GitHub: git@github.com:natthaphonKhaokkaeo/Apartment.git, main.
- Docker Compose DEV web + API on VPS loopback 127.0.0.1:18088; /readyz 200 and unauthorized API 401. **Not Dokploy-managed** (Dokploy API 401 without x-api-key).
- Deployment files: docker-compose.dokploy.yml, infra/Dockerfile, infra/nginx.dev.conf; runtime secrets at /etc/dokploy/runtime-env/apartment-api.env (mode 0600, untracked).
- Existing PostgreSQL reused via apartment-dev_default network; no duplicate database.
- P3 finance: apps/api/src/routes/financial-adjustments.ts, services/financial-position.ts, services/financial-rules.ts, tests/financial-rules.test.ts, scripts/smoke-financial-adjustments.ts, Drizzle 0008, apps/web/src/components/FinancialAdjustmentCenter.tsx.
- Documents: docs/DEPLOY_DOKPLOY_DEV.md and docs/P3_FINANCIAL_ADJUSTMENTS.md.
\n## Latest P4-01/02/03 DEV implementation\n- apps/api/src/services/line-oa.ts, line-outbox.ts, routes/line-oa.ts, scripts/dispatch-line-outbox.ts, scripts/smoke-line-oa.ts and tests/line-oa.test.ts. Drizzle 0009.\n- docs/P4_LINE_OA_WEBHOOK_OUTBOX.md has threat model, exact key list, state/retry definitions and pending gates.\n- Dokploy record: Project Apartment, Environment dev, Compose Apartment DEV, id E62Ag2umCDl9Q2ChzGOPB; configured Git HTTPS main and Compose path. **Running Healthy under Dokploy.** Port 18089 bound to loopback; old standalone 18088 was shut down safely after confirmation.\n
Latest managed deployment proof: Dokploy composeId E62Ag2umCDl9Q2ChzGOPB status done; Docker project apartment-dokploy-dev-ajcnbm API/Web both healthy; 18089 web/readyz 200 and unauthenticated auth guard 401; old Compose 18088 stopped. Need redeploy with latest P4 commit before LINE webhook code is in running images.

P4 rollout gate: source commit 3fd4fb6 pushed, but running Dokploy images are still pre-P4 (webhook 404). Current runtime WEB_ORIGIN=18088 conflicts with managed host port 18089; private runtime ENV file already corrected to 18089, requires authenticated Dokploy Dashboard Redeploy. See docs/DEPLOY_DOKPLOY_DEV.md. Do not claim new P4 route live until verified 503 when no secret and origin guard normal.

Domain checkpoint: https://apartme.makemarket.space now works (HTTPS trusted; web/readyz=200, unauthorized=401, correct-origin POST=200, unsigned OA webhook=503). Runtime WEB_ORIGIN matches domain and Secure Cookie enabled. Important unresolved infrastructure issue: shared Traefik ACME bind is read-only and acme.json empty, so do NOT restart shared Traefik until certificate persistence/renewal is repaired with a maintenance plan. See docs/DEPLOY_DOKPLOY_DEV.md. LINE credentials still missing.

## P4-04 tenant consent and invoice notifications (DEV)
- API routes: apps/api/src/routes/line-consent.ts (GET own preferences; PUT opt-in/revoke, explicit policyVersion + affirmative acknowledgment; cross-tenant IDOR blocked)
- Service: apps/api/src/services/line-notifications.ts (generic Thai messages; transactional consent-bound BILL_ISSUED/PAYMENT_DUE outbox entries)
- Due CLI: apps/api/src/services/line-due-reminders.ts and scripts/prepare-line-due-reminders.ts (Bangkok date, organization-specific dry-run by default, exact due date, outstanding and pending-claim checks, queue only)
- UI: apps/web/src/components/TenantNotificationPreferences.tsx integrated in TenantPortal.
- Test: apps/api/tests/line-notifications.test.ts and apps/api/scripts/smoke-line-consent.ts; run corepack pnpm --filter @apartment/api smoke:consent.
- No DB migration necessary; reuses LINE schema from 0009. Real OA/LIFF credentials missing; LINE_OUTBOUND_MODE=disabled, no automated or real sending.
- Handoff spec: docs/P4_TENANT_CONSENT_NOTIFICATIONS.md.

## P4-04 managed DEV deployment verification — 2026-11-03
- P4-04 code commit d01e1c2 is pushed to GitHub main and Docker API/Web images were rebuilt and recreated in existing Dokploy Compose project apartment-dokploy-dev-ajcnbm (NO other projects touched).
- Public https://apartme.makemarket.space/ and /readyz return 200 with trusted TLS; GET /v1/tenant/notification-consents and unauthenticated PUT both return 401; unsigned /v1/line/oa/webhook returns 503 because real LINE secret remains unconfigured.
- API route source is present in managed container; LINE_OUTBOUND_MODE defaults to disabled and NO messages were sent.
- CLI safe dry-run tested; trying --apply without --confirm-queue-only fails. PostgreSQL remains Healthy with 22 tables (no migration needed).
- Keep P4-04 marked PARTIAL for invitation/repair templates and real LINE provider/consent acceptance. Traefik ACME storage durability issue remains as documented.

## P4-03c observer / Dead-letter operations
- apps/api/src/services/line-operations.ts, routes/line-operations.ts and scripts/line-outbox-worker.ts; new migration 0010 dead-letter review records.
- apps/web/src/components/LineOperationsAdmin.tsx shown to Platform Super Admin only; endpoints return no recipient or message contents.
- Dokploy Compose adds line-observer with LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false and LINE_OUTBOUND_MODE=disabled, heartbeat health, private DB network only.
- Run smoke:line (admin status and Dead-letter review), line:worker --once and full regression. Live LINE provider still blocked. See docs/P4_LINE_OPERATIONS.md.

## P4-03c verified deployment checkpoint 2026-11-03
- Feature commit 983fd6b pushed to GitHub main; built images and Docker Compose updated within existing Dokploy project apartment-dokploy-dev-ajcnbm without modifying other services.
- Managed services api/web/line-observer all Healthy; apartment-dev-postgres-1 Healthy and database 23 tables, migration 0010 applied.
- Public https://apartme.makemarket.space and /readyz 200 with TLS verify=0; both unauthenticated operator endpoints 401.
- line-observer mode observe, approved false, outbound disabled, poll 60s, heartbeat age 11s, dispatched 0. Dedicated no-port worker is running but does NOT send.
- 59 tests + all regression suites + Vite/TypeScript + LINE worker one-shot passed. No LINE live provider keys are configured.
- Docs/P4_LINE_OPERATIONS.md contains operator monitoring endpoints, restrictions, remaining quota/alert/consent live gates.

## P4-03d quota/fairness and internal alerts DEV
- API modules: src/services/line-fairness.ts, line-alerts.ts, line-outbox.ts (PostgreSQL global advisory transaction lock and reserved attempt table), line-operations.ts (per-org window usage), routes/line-operations.ts (scoped alert list/ack).
- Worker: scripts/line-outbox-worker.ts now reconciles internal alerts in OBSERVE mode on each heartbeat; never sends LINE.
- New schema migration 0011: line_dispatch_reservations and line_ops_alerts (unique open incident per org/kind).
- UI: apps/web/src/components/LineOperationsAdmin.tsx displays quota-window usage and active internal incidents; acknowledgment does not retry.
- Tests: tests/line-fairness.test.ts + extended scripts/smoke-line-oa.ts for concurrent quota and durable alert lifecycle.
- No external alerts, no real LINE deliveries, multi-channel fairness/retention/consent in-flight gates remain pending. See docs/P4_LINE_QUOTAS_ALERTS.md.

## P4-03d verified managed deployment
- Feature commit 826550c, Compose quota setting commit 9295d2e both pushed to GitHub main. Existing Apartment Dokploy project rebuilt/recreated the API/Web and Observer only.
- PostgreSQL has 25 tables, migration 0011 applied. All 61 unit tests and full existing smoke suites passed.
- Public https://apartme.makemarket.space/ and /readyz 200, TLS verify 0; unauthenticated /v1/admin/line-operations/alerts 401.
- API, Web, Observer, old Postgres all Healthy; observer heartbeat age 18s, LINE_WORKER_MODE observe, LINE_WORKER_APPROVED false, LINE_OUTBOUND_MODE disabled, quota env perorg=5/global=20, dispatched=0.
- Incidents are INTERNAL database + admin UI only; no paging/no real LINE messages, and external LINE Provider quota is still unverified. Keep P4-05 Sandbox and provider acceptance gate pending.

## P4-03e consent race + reservation retention / PostgreSQL backup (2026-11-03)
- apps/api/src/services/line-outbox.ts: LIVE path revalidates active lease -> enabled OA -> active matching consent using FOR SHARE locks while the bounded provider call executes; tenant revoke uses lease/consent FOR UPDATE. A revoked consent stops future new dispatches. Existing in-flight calls cannot be recalled, and a revoke in progress may wait for the provider request (up to 7s in real LINE HTTP). Never claim absolute delivery cancel.
- apps/api/src/services/line-retention.ts and scripts/cleanup-line-reservations.ts: org-scoped 30-day reservation retention; dry-run default, confirmed apply max 100 rows per CLI invocation. Manual only; no automatic cleanup timer. Real PostgreSQL smoke verifies organization scope and bounded deletion.
- infra/backup-apartment-postgres.sh, infra/systemd/apartment-postgres-backup.{service,timer}, docs/POSTGRES_BACKUP_RESTORE.md. Enabled real VPS systemd timer daily 03:30 Asia/Bangkok. Source Docker volume unchanged. Verified live pg_dump custom format, SHA-256 and full restore to temporary postgres:16 container with --network none (25 public tables), not production DB.
- Physical data is still on the SAME VPS. Offsite encrypted copy, backup success notification and independent restore test are not configured. Do not claim disaster recovery readiness.
- Read docs/P4_LINE_RETENTION.md and docs/POSTGRES_BACKUP_RESTORE.md.

## Final P4-03e + database backup DEV validation (2026-11-03)
- Feature commit b0d55eb pushed to main; existing Apartment Dokploy project rebuilt and updated API/Web/line-observer only. All three containers and PostgreSQL Healthy.
- Public HTTPS/readyz 200 with valid TLS (verify 0); unauthenticated alerts API returns 401. Observer heartbeat fresh (8s), LIVE worker OFF: observe/approval false/outbound disabled.
- systemd apartment-postgres-backup.timer ACTIVE with next 2026-11-04 03:30:00 Asia/Bangkok; backup service manual execution SUCCESS. Root-only /root/backups/apartment-postgres backup files have SHA-256, backup script verify PASS, restore to independent ephemeral PostgreSQL 16 network-none container PASS (25 public tables); no DB downtime. Need OFFSITE backup before Production.
- 63 unit tests + API/finance/payment/S3/cleanup/LINE suites/typecheck/web build PASS; P4-03e live consent race and reservation retention smoke PASS.
- P4-05 LINE provider Sandbox/login/LIFF E2E awaits actual credentials; no real sending. Shared Traefik ACME read-only bind still needs risk-controlled maintenance. See docs/POSTGRES_BACKUP_RESTORE.md and docs/P4_LINE_RETENTION.md.

## P1-01a owner move-out / lease closure (DEV)
- Code: apps/api/src/services/lease-lifecycle.ts, apps/api/src/routes/lease-lifecycle.ts, registered in index.ts; owner Rooms UI in apps/web/src/main.tsx.
- Strict gates: active owner org membership (not manager/admin override), exclusive end date after start and <= Bangkok today, final water+electric readings, final ISSUED invoice exactly at boundary, all issued invoices settled, no pending payment/finance requests. Property->lease->room transaction locks shared property lock with invoice issuer.
- Success: ENDED lease/endDate, room AVAILABLE or MAINTENANCE, revoke invitations, LINE consents and queued/retry/sending Outbox; audit. No existing invoice or ledger mutated.
- Test: apps/api/tests/lease-lifecycle.test.ts and extended apps/api/scripts/smoke-line-consent.ts with owner/manager/IDOR, pending/unsettled, retry, LINE revoke and room reuse.
- No DB migration needed. P1-01b maintenance repair/deposit, P1-02 effective-dated rates and P1-03 midcycle invoices, former-tenant history remain pending. Read docs/P1_LEASE_MOVE_OUT.md.

## P1-01a deployed DEV validation
- Feature commit f94e6a4 pushed. Existing Dokploy Apartment DEV API/Web/Observer rebuilt and Healthy, PostgreSQL Healthy and backup timer active.
- Public HTTPS/readyz 200 with valid TLS; unauthorized move-out POST 401; LINE observer outbound disabled.
- 64 unit tests (11 domain, 53 API), full payments/finance/S3/LINE/cleanup HTTP and PostgreSQL smoke, TypeScript, Vite and Compose checks passed.
- No migration. P1-01b repair, deposits, midcycle and former-tenant history still pending. Continue P1-02 rate history and P1-03 prorating next.
