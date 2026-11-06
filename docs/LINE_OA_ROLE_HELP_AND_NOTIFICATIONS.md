# LINE OA Help Bot and Organization Notifications

## Organization notification inbox

The application stores recipient scoped notifications in `org_notifications`. Notification fan-out targets active memberships in the affected organization and occurs in the source transaction. A unique key on `(organization_id, recipient_user_id, event_key)` makes transaction retries idempotent.

Implemented events:

- `ROOM_CREATED`: room added to a property.
- `INVOICE_ISSUED`: invoice issued individually or by an approved billing batch.
- `STAFF_ROLE_CHANGED`: staff invitation approved or staff access revoked.

API contract:

- `GET /v1/notifications?limit=30&unreadOnly=true` — returns only the signed-in user's inbox; `limit` is 1–100.
- `POST /v1/notifications/:notificationId/read` — marks only a notification owned by the signed-in user as read; returns 404 for another user's ID.

The web console exposes the inbox through the **แจ้งเตือน** navigation entry. Notifications contain operational context only. The API relies on the existing authenticated session and never accepts a recipient ID from the caller.

Tenant LINE bill and maintenance messages remain a separate channel. They continue to require explicit tenant consent and use the existing LINE outbox. Organization inbox events do not trigger LINE push messages.

## Role-scoped LINE help

The webhook continues to verify `X-Line-Signature` against raw request bytes, deduplicate by LINE webhook event ID, and resolve role server-side. Membership role lookup is scoped to the active organization bound to the LINE OA; tenant role lookup is scoped to an active lease in that organization. Unknown/unlinked users receive only public help content.

The retrieval corpus is kept in `apps/api/src/services/line-help-rag.ts`. Keyword retrieval filters the corpus by role before any context is sent to the model. The model prompt instructs the provider to answer only from those retrieved support articles. No invoices, tenant records, credentials, or organization-specific database data are sent to the AI provider. On an empty retrieval or provider failure, the bot uses a safe support handoff response or the retrieved article text.

Configuration:

```dotenv
LINE_CHATBOT_MODE=disabled
LINE_CHATBOT_LIVE_APPROVED=false
LINE_HELP_AI_PROVIDER=openrouter
LINE_HELP_AI_API_KEY=
LINE_HELP_AI_MODEL=nvidia/nemotron-3.5-lightning:free
```

- `disabled` (default): persist/deduplicate webhook events; do not run the bot or send replies.
- `simulate`: process a role-scoped answer but do not send a LINE reply. An AI key is optional; without it, the bot returns retrieved help text.
- `live`: reply to eligible direct user text messages through LINE Messaging API only when both `LINE_CHATBOT_MODE=live` and `LINE_CHATBOT_LIVE_APPROVED=true` are explicitly configured. This requires an approved operational change, a valid channel access token, webhook configuration, and provider testing. Do not set these values as part of a routine deploy.

The provider API key is runtime secret material. Keep it in the deployment secret store, never in source control or logs. Email, phone-like numbers, and LINE user IDs are redacted before provider calls; only the sanitized question and role-filtered help articles are sent. The provider and model are configurable. OpenRouter uses its OpenAI-compatible chat completions endpoint and Bearer authorization. OpenRouter's `openrouter/free` router selects among available free models; free model variants have usage limits, and availability can change. The automated tests use mocked responses; the DEV provider smoke separately verifies a real OpenRouter response. Do not send sensitive tenant/account or payment data.

## Operational validation

- Unit tests: `corepack pnpm --filter @apartment/api exec vitest run tests/line-help-rag.test.ts tests/line-oa.test.ts tests/org-notifications.test.ts`
- Migration is `apps/api/drizzle/0022_clean_the_call.sql`; apply it only through the normal migration pipeline after an isolated PostgreSQL migration check.
- Verify notification recipient isolation with separate signed-in users during UAT.
- Default configuration remains disabled. The DEV chatbot has explicit operator approval and is configured for live LINE replies with OpenRouter. On provider errors or quota limits, it falls back to role-filtered help text from the local corpus. The general LINE outbox worker remains observe-only and outbound notification dispatch is not enabled.


## DEV runtime status (2026-11-06)
- `LINE_CHATBOT_MODE=live` and `LINE_CHATBOT_LIVE_APPROVED=true` are set in the protected Dokploy runtime environment. LINE credentials were verified with the read-only Bot Info endpoint; the configured bot ID matched. No test message was sent.
- The API, web, and observer containers are healthy after deploy. OpenRouter is configured as the AI provider; the provider was tested with a role-scoped help query and returned generated text. If it is unavailable, the bot falls back to the local role-filtered corpus.
- `LINE_OUTBOUND_MODE=disabled`; the observer remains pinned to observe-only. Bill/permission notification fan-out is not being dispatched to LINE yet.
