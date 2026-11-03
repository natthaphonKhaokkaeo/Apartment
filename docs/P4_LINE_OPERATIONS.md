# P4-03c — LINE Outbox Operations and Safe Observer (DEV)

2026-11-03 checkpoint: Observability implementation and continuous DEV observer are complete. REAL LINE messages are **disabled**. Provider sandbox, actual LINE quotas, incident paging, consent-revoke in-flight guarantees and production acceptance remain pending.

## Operator API and Admin UI

All endpoints require an authenticated SUPER_ADMIN session and exact organizationId (UUID). No endpoint lists across organizations in an API response.

- GET /v1/admin/line-operations/overview?organizationId=UUID — status totals, unreviewedDeadCount, expiredSendingLeaseCount and oldest active/Dead-letter ages.
- GET /v1/admin/line-operations/dead-letters?organizationId=UUID&limit=40 — at most 50 DEAD items; status/template/attempts/safe error code/reviewedAt; never exposes recipient, LINE User ID, message body, retry key or token.
- POST /v1/admin/line-operations/dead-letters/:outboxId/acknowledge — body organizationId, reviewReason (15–500 chars). Only one review per terminal job, transaction lock + immutable audit log, never requeue, 409 repeat or non-DEAD, 404 wrong scope.
- Super Admin view has an organization-specific status panel and masked Dead-letter list with a one-time acknowledge action.

ACCEPTED means the LINE HTTP endpoint accepted the request, NOT that the person received or read the message. SIMULATED means no message was sent.

Migration 0010 introduces line_outbox_dead_reviews with a unique outbox FK and actor/reason/time.

## Dedicated Dokploy observer service

The Compose service line-observer uses the existing API image. It has no public ports and only joins the private apartment PostgreSQL network. Its settings are always overridden to:

    LINE_WORKER_MODE=observe
    LINE_WORKER_APPROVED=false
    LINE_OUTBOUND_MODE=disabled
    LINE_WORKER_INTERVAL_MS=60000

Every 60 seconds it samples only aggregate statuses (no PII), prints redacted summary logs periodically and writes a heartbeat to /tmp/apartment-line-worker-heartbeat. Docker Healthcheck fails if it has not updated for 180 seconds.

To inspect:
    docker compose -p apartment-dokploy-dev-ajcnbm -f docker-compose.dokploy.yml ps
    docker logs --tail 15 apartment-dokploy-dev-ajcnbm-line-observer-1
    corepack pnpm --filter @apartment/api line:worker --once

The one-shot command performs an observation and exits. A real live sender is gated in source behind LINE_WORKER_MODE=live, LINE_WORKER_APPROVED=true, LINE_OUTBOUND_MODE=live and valid Messaging OA secret/token/bot ID. This is NOT authorization to enable live sends. Before removing the DEV Compose overrides, validate real LINE sandbox, explicit lawful consent, quota/fairness, in-flight cancellation risk, safe retries, monitoring and incident runbooks. The code caps 3 jobs per minute per worker but does NOT guarantee cross-replica or multi-channel quota fairness.

## Verification and pending work

- New pure tests: mode gating matrix, error-code redaction, age.
- Real PostgreSQL HTTP smoke: anonymous/user 401/403, scoped admin counts, cross-org 404, dead-list masks PII, review once, repeat 409, status remains DEAD and audit recorded.
- Dedicated observer one-shot, Docker heartbeat and full regression/typecheck/build checks are required before handoff.

Open gates: external LINE/LIFF E2E, quota and notification fairness, delivery callbacks, dead-letter paging, retention, legal privacy approval and a true production live worker. Do not claim automatic real messaging or that a previously sent notification can be recalled.

## Deployment validation
Existing Apartment DEV Compose is running api, web and line-observer. All Healthy after deploying feature commit 983fd6b. LINE observer wrote fresh heartbeat and emitted redacted status summary with dispatched=0. Public HTTPS / and /readyz returned 200 with trusted TLS; unauthenticated operations endpoints returned 401. Existing PostgreSQL was preserved, and no other VPS app was touched. Operator scope/acknowledgment tested with real PostgreSQL HTTP fixtures. No real LINE messages sent.

## P4-03d update
Per-organization + global rolling rate quota reservations, fairness selection, incident episode persistence (unreviewed DEAD, stale SENDING and old QUEUED/RETRY), admin alert API/UI, and observer alert reconciliation now exist in DEV. Alerts are internal only; NO real LINE sending or external paging. Full policy/runbook: docs/P4_LINE_QUOTAS_ALERTS.md.
