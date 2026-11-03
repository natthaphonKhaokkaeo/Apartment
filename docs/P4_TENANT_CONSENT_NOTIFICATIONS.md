# P4-04 — Tenant LINE Notification Consent and Invoice Events (DEV)

Status: 2026-11-03 — **consent controls, bill-issued Outbox producer, and manual payment-due preparation implemented and tested in DEV**. Invitation and maintenance templates/event producers remain dependent on future features. **No real LINE messages are being sent.**

## Consent flows and data minimization

A tenant must first authenticate via the existing LINE Login session and have an **active lease explicitly linked to that very same LINE subject after owner approval**. No caller-supplied organization, tenant or recipient ID can override the verified subject. Consent is independent for each lease and owner organization.

- GET /v1/tenant/notification-consents — list active verified linked leases and own notification preferences. Returns only propertyName, leaseId, enabled, available, consent dates, policyVersion and outboundActive flag. Does not expose Line User ID, access tokens, other tenants or invitation codes.
- PUT /v1/tenant/leases/:leaseId/notification-consent — authenticated tenant only, with an active linked lease. Granting requires EXACT {enabled:true,policyVersion:"2026-11-v1",acknowledgedPurpose:true}. Revoking uses {enabled:false}; it is allowed even when the OA is disabled. GET/PUT responses use no-store.
- TenantPortal exposes voluntary opt-in with an **unchecked** purpose acknowledgment; it is not a mandatory requirement to read bills. A single click can revoke, with a confirmation notice.
- The persisted consent uses binding/organization/lease/recipient scope, consent evidence source, server timestamp, and revoke timestamp. Grant/revoke writes an audit event with authenticated actor; a repeated identical action is idempotent. A regrant refreshes the policy evidence date without resurrecting DEAD Outbox jobs.
- Revoke atomically updates current consent and marks all QUEUED, RETRY and SENDING jobs for that consent DEAD with a safe reason. This prevents new work from being sent but **cannot recall a push already transmitted over the network**; concurrent in-flight provider behavior needs additional production gate.

**Important:** OA binding must be enabled and match the server-configured LINE_OA_BOT_USER_ID before granting consent. Without a configured OA, the preferences are visible as unavailable and no new consent can be granted. When actual LINE outbound mode is disabled, the UI discloses that no messages are being sent yet.

## Bill-issued Outbox event

On successful POST /v1/properties/:propertyId/bills/issue, the invoice and a possible LINE Outbox entry are written **inside the same PostgreSQL transaction**. A message is added ONLY when:

1. The billed lease is active, and its LINE subject is verified from the lease.
2. The owner's organization has an enabled OA binding.
3. A non-revoked consent matches the **exact** organization, OA, lease and LINE subject.

The message uses a generic Thai text advising the tenant to log into the portal to see their bill, with no tenant name, room number, bank info or bill amount. Its dedupe event key is BILL_ISSUED:<invoice-UUID>. Replaying the bill-issue idempotency key does not enqueue a duplicate. If no OA/consent, the invoice still issues normally and notificationStatus is INELIGIBLE. There is **no synchronous LINE API call** in the invoice transaction.

## Payment-due reminder preparation (manual, safe default)

Run from /root/Projects/Apartment (one org at a time):

    corepack pnpm --filter @apartment/api line:prepare-due --organization-id=<UUID>

This is DRY_RUN by default and counts candidate invoices; it makes no DB mutations and does not send messages.

To explicitly create due-date Outbox entries:

    corepack pnpm --filter @apartment/api line:prepare-due --apply --confirm-queue-only --organization-id=<UUID> --date=YYYY-MM-DD

Constraints:
- Only ISSUED invoices with dueDate matching the **current Asia/Bangkok date** can be queued in APPLY mode. An arbitrary historical/future date is rejected.
- Candidate batch capped at 50 per invocation by CLI (100 in service), scoped to the supplied organization.
- Invoice row lock protects balance from concurrent manual payment approval/finance corrections. FULLY PAID invoices and invoices with PENDING payment claims are skipped.
- Requires a verified OA, active linked lease and explicit current consent, same as bill-issued event. eventKey PAYMENT_DUE:<invoice-UUID> prevents duplicate queues.
- DRY_RUN "eligible" means potential candidate count (not validated recipient eligibility). APPLY reports actual queued/skipped/alreadyQueued counts.
- This CLI **does not dispatch LINE messages**. It only persists Outbox entries. No cron / scheduler was set up by this phase.
- The one-shot worker remains disabled by default; no real provider calls without separate keys, reviewed consent, and deliberate live-send confirmation.

## Verification

Run:
- corepack pnpm test
- corepack pnpm typecheck
- corepack pnpm --filter @apartment/web build
- corepack pnpm --filter @apartment/api smoke:line
- corepack pnpm --filter @apartment/api smoke:consent

The isolated DEV PostgreSQL/HTTP consent smoke verifies: missing OA (409), explicit consent acknowledgment and version validation (400), cross-user/owner access denied (404), no outbox before consent, bill creation atomic enqueue, repeated bill not duplicated, revocation cancels queued notifications, regrant does not revive dead jobs, pending/fully recorded payments suppress due reminders, cross-org filter, Bangkok-day guard, and disabled worker does not send. Test-created fixtures are cleaned.

## External and future gates

- [ ] Real LINE Login/LIFF E2E, LINE OA secrets/Channel Access Token and messaging sandbox
- [ ] Owner-facing OA configuration, multi-channel credential isolation, explicit policy/privacy terms, consent activity visibility, consent retention policy and role-based review
- [ ] Repair event integration (requires P5 maintenance tickets); invitation event templates only after safely handling invite recipient/consent proof
- [ ] Scheduled monitored worker, dead-letter reviews, quota and failure alerts, race-safe in-flight consent revocation guarantee
- [ ] Production security/legal and automated deployment verification

No new API key is needed to build this phase. Existing LINE credentials from docs/ENV_REQUIRED.md remain required for LIVE messaging. Do not set LINE_OUTBOUND_MODE=live until the above gates are met.

## Deployment proof
DEV commit d01e1c2 was pushed and deployed to the existing Dokploy-managed Apartment DEV project at https://apartme.makemarket.space. Website and readiness 200 with valid TLS, tenant consent read/write without login 401, and LINE webhook without credentials 503. API/Web/Postgres healthy; Outbound mode disabled. No LINE provider message has been sent and P4-04 remains PARTIAL for real external acceptance and invitation/repair workflows.
