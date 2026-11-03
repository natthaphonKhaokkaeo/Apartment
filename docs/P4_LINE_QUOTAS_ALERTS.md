# P4-03d — LINE Outbox Quotas, Fairness and Durable Internal Alerts

Checkpoint 2026-11-03: Implemented in DEV with mock sender/PostgreSQL integration. Live LINE messaging is DISABLED, so **no real LINE delivery or real provider quota acceptance is claimed**.

## Conservative quota reservations

- The dispatch loop reserves one durable row in line_dispatch_reservations inside the same PostgreSQL transaction that claims an Outbox job. Reservation records count *attempts* rather than deliveries: a timeout, revoked consent or rejected provider response still consumes a quota unit (fail closed).
- A single PostgreSQL transaction advisory lock serializes the global and per-organization rate window across multiple worker replicas. The transaction ends before any external provider call. Existing LINE retry keys remain unchanged across attempts.
- The send window is a rolling 60 seconds, and the worker ranks organizations by **fewest recent reserved attempts**, then oldest queued notification, when deciding which organization to claim next. It uses FOR UPDATE SKIP LOCKED for an individual job. This provides DB-level per-organization selection fairness but is not a provider-wide SLA or strict tenant fairness.
- Conservative defaults: LINE_GLOBAL_PER_MINUTE=20 and LINE_ORG_PER_MINUTE=5. Validate positive integers, at most 60, per-organization no greater than global. Both values are overridden explicitly for the DEV line-observer (which is observe-only and cannot send). Actual quotas must be calibrated to LINE Messaging API verified limits and account entitlements prior to live activation.
- When all eligible organizations are exhausted for the minute, no job is claimed, and the batch reports quotaLimited. Already expired SENDING leases are still subject to the quotas; this is intentionally conservative.
- Reservation rows persist for audit and rate limiting. Historic reservation retention/cleanup is **NOT yet automated** and requires a data-retention review.

## Durable internal incident alerts

line_ops_alerts has a unique active (organization, kind) constraint. The existing observer (60-second loop, no sending) now evaluates and reconciles:

- DEAD_UNREVIEWED: at least one DEAD job has no recorded human review.
- EXPIRED_SENDING_LEASE: a SENDING job has an expired lease.
- QUEUE_BACKLOG: the oldest QUEUED/RETRY message has been waiting for at least 900 seconds.

An alert is opened once per incident episode, updated on subsequent observations, and automatically resolved once the condition ends. Previous resolved episodes remain available for audit. Reconciliation is bounded to 150 organizations per tick (scaling/pagination is pending).

Super Admin only:
- GET /v1/admin/line-operations/alerts?organizationId=UUID
- POST /v1/admin/line-operations/alerts/:alertId/acknowledge with organizationId

Alert acknowledgment is once-only and audited. It does not resolve an active incident, requeue or send messages, and does not contact external channels. Duplicate/cross-org/non-admin requests are denied.

Platform Admin displays open alerts, acknowledgment state, and the organization's reservation usage vs. quota. Responses disclose no LINE User ID, message text, retry key or access token.

**These alerts are internal dashboard/database alerts only. There is currently NO external paging, push, email, Slack or LINE notification to operators.**

## Security and validation

- TDD unit tests cover deterministic least-used-org rotation, exhausted quotas and incident thresholds.
- PostgreSQL + HTTP smoke verifies two simultaneous workers cannot exceed the one-send test quota window, and a subsequent window allows another attempt. Sender is mocked; no LINE network calls.
- HTTP smoke verifies incidents open/acknowledge/resolve with audit and unique active incidents; anonymous/user denied; cross-org denied; duplicate acknowledgment 409. Original DEAD Outbox rows remain terminal.
- Full tests, typecheck, React build, prior payments, finance, evidence, LINE consent and observer smoke must pass before deployment.

## Open gates

- Real LINE sandbox delivery, per-channel quotas and account entitlement acceptance.
- Multi-OA credential routing, per-channel/tenant fairness and reliable sequencing.
- Safe handling of in-flight consent revocation and uncertain provider receipt, operational paging/escalations.
- Reservation retention/purge and durable alert pagination for large installations.
- HTTPS certificate durability: Traefik ACME storage read-only issue separately documented.

DEV Compose retains LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false and LINE_OUTBOUND_MODE=disabled. **No live sender is deployed or authorized.**

## DEV deployment proof
Commit 826550c implements quota/fairness/incident code; 9295d2e pins observer DEV quota environment. Both are pushed to main. Existing Dokploy Apartment DEV API/Web/Observer were rebuilt and updated with no impact to other services. All are Healthy, PostgreSQL still Healthy (25 tables), HTTPS site and readiness 200 with TLS verification success, Admin incident endpoint denies unauthenticated with 401. Observer heartbeat fresh, aggregate incident check runs, dispatched=0 and LINE outbound disabled. This is NOT real LINE provider delivery acceptance or external operator paging.
