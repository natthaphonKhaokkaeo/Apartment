# Phase P4 — LINE OA Binding, Signed Webhook & Durable Outbox

Checkpoint 2026-11-03: **DEV implementation and tests completed**, but there are no real LINE OA secrets, no real messages delivered, no live webhook from LINE, no consent-capture screen, and no live outbound worker in Dokploy; a safe observe-only monitor runs. Production remains intentionally disabled.

## Inbound security

- One owner organization has **at most one** OA binding in \`line_oa_bindings\`. The LINE bot User ID (webhook \`destination\`) is also unique, preventing a single channel from being assigned to multiple organizations. One binding can serve multiple properties within the organization.
- SUPER_ADMIN-only \`PUT /v1/admin/line-oa/bindings\` requires the bot User ID to match server-configured \`LINE_OA_BOT_USER_ID\`; enabling also requires \`LINE_MESSAGING_CHANNEL_SECRET\`. \`GET /v1/admin/line-oa/bindings\` lists safe fields but **never returns secrets**.
- \`POST /v1/line/oa/webhook\` uses an encapsulated Fastify JSON parser that preserves **raw UTF-8 bytes**. Verify \`x-line-signature\` by HMAC-SHA256 (constant-time comparison) before parsing JSON; reject missing/invalid signature with 401. Limit webhook to 256 KiB, max 100 event records and rate limit 60 requests/minute.
- \`destination\` must match the configured bot and an enabled binding whose organization is active; otherwise 404/409. Events stored atomically with a unique (binding_id, webhook_event_id) key. LINE redelivery only increments \`duplicates\` response, never inserts a second event.
- Do not store raw webhook body, text messages, user profile data, reply tokens, or access tokens. Store event ID, type, redelivery bit and SHA-256 pseudonymous source User ID only.
- The webhook currently **does not send automatic replies** or enqueue notifications; consent and business-event automation are Phase P4-04.

LINE reference: https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature

## Outbound outbox

- \`line_notification_consents\` is scoped to an actual active lease, LINE user and OA binding, with evidence and revocation timestamps. **There is no consent-capture UI or public enqueue API yet.** Future authenticated LIFF onboarding must create explicit, auditable consent before sending.
- Internal service \`enqueueLineNotification()\` only accepts a supported message template identifier, matching binding/organization/lease/consent/recipient and a unique eventKey. Duplicate enqueue returns the same job; changed payload with the same key is a 409 conflict.
- \`line_outbox\` contains durable message body, stable UUID \`retry_key\`, attempts, next attempt, in-flight lease, status and provider request ID. Worker states: QUEUED → SENDING → ACCEPTED / RETRY / DEAD, plus explicit SIMULATED (no real message). Never present SIMULATED as delivered.
- \`runLineOutboxBatch()\` acquires PostgreSQL row locks with SKIP LOCKED, bounds to 10 jobs/run, reclaims crashed SENDING leases after timeout, and rechecks active binding, lease and consent before send. 2xx accepted; 409 accepted only with \`x-line-accepted-request-id\`; 429 / 5xx / network failure retry exponentially (max 5 attempts); other 4xx terminal; old uncertain sends stop before LINE's 24-hour retry-key window. All attempts use original \`X-Line-Retry-Key\` and immutable recipient/message. Errors are recorded only as safe codes.
- Official LINE retry-key behavior: https://developers.line.biz/en/docs/messaging-api/retrying-api-request

**No automatic outbound job/scheduler has been deployed.**

## Environment & operator controls

The following app environment variables are supported; none is required for DEV baseline:

\`\`\`dotenv
LINE_MESSAGING_CHANNEL_SECRET=
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=
LINE_OA_BOT_USER_ID=
LINE_OUTBOUND_MODE=disabled
\`\`\`

- \`disabled\`: no jobs dispatched or messages sent (DEV default).
- \`simulate\`: tests outbox flow and marks SIMULATED, **not** accepted/delivered.
- \`live\`: validates required secrets and bot ID; real sending requires explicit CLI \`--live --confirm-real-messages\`. Do not enable until consent/legal policies and approved production review.
- \`LINE_WEBHOOK_PUBLIC_URL\` is **not used by the app**; configure an actual HTTPS webhook URL in LINE Developers when ready, pointing to \`/v1/line/oa/webhook\`.

DEV commands:

\`\`\`bash
corepack pnpm --filter @apartment/api smoke:line
corepack pnpm --filter @apartment/api line:dispatch             # disabled; no outbound traffic
corepack pnpm --filter @apartment/api line:dispatch --simulate  # simulated, no outbound traffic
\`\`\`

The live command exists but is **not to be scheduled or run without real tenant consent and provider acceptance**.

## Verified and remaining work

- [x] Official LINE HMAC golden vector with raw-body mutation rejection, invalid signature and event payload tests
- [x] Real PostgreSQL + HTTP webhook signature/400/401/404/event dedup tests; no private message text persisted
- [x] Durable scoped, consent-bound outbox, idempotent eventKey, simulated no-send, stable retry key, retry 429→accepted, revoked-consent DEAD smoke tests
- [x] Mock push HTTP test confirms exact retry header, recipient/text and 409 accepted-request-id policy
- [ ] Real LINE OA secret/token/bot binding and sandbox HTTPS webhook test
- [ ] Authenticated tenant LIFF explicit opt-in/out UI, privacy notices, invitation/bill-due event producers, notification templates and owner settings (P4-04)
- [ ] Persistent scheduler/process, monitoring and dead-letter review UI; provider quota checks and production signoff
- [ ] Multi-channel secrets manager per organization. Current DEV server supports **one configured OA at a time**; schema supports multiple OA bindings, but do not enable multiple channels without proper per-channel secret resolution

## P4-03c addendum
The Dokploy DEV worker reads aggregate status and has a Docker heartbeat healthcheck. SUPER_ADMIN scoped API/UI supports masked dead-letter inspection and one-time acknowledgment with audit (not retry). Live bill notification activation is documented below. See docs/P4_LINE_OPERATIONS.md.


## DEV live bill notifications (2026-11-06)

- The operator approved live LINE event notifications on DEV; this is independent of the AI help chatbot and does not call an AI provider.
- Issuing an individual or batch invoice inserts one idempotent `BILL_ISSUED` event into the outbox in the same database transaction.
- The worker prepares `PAYMENT_DUE` reminders once per Bangkok due date and dispatches them automatically.
- Dispatch requires an enabled organization LINE OA binding, an active lease linked to the recipient's LINE account, and an unrevoked explicit tenant notification consent. Consent revocation invalidates pending/retry sends.
- Current activation starts with an empty outbox; no old notifications were sent on enablement. The worker's DEV rate limit is at most three dispatch attempts per minute. A LINE API acceptance is not treated as proof that the recipient read the message.
- The API and worker now require the same live mode and credentials. `infra/deploy-apartment-dev.sh` checks operator approval, required credentials, and the live due-reminder flag before deployment.
- Maintenance LINE notification producers and full provider delivery UAT are still pending; do not claim every operational event type is live.
