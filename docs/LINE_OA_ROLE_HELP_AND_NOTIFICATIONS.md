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
LINE_HELP_AI_API_KEY=
LINE_HELP_AI_MODEL=gemini-3.8-flash
```

- `disabled` (default): persist/deduplicate webhook events; do not run the bot or send replies.
- `simulate`: process a role-scoped answer but do not send a LINE reply. An AI key is optional; without it, the bot returns retrieved help text.
- `live`: reply to eligible direct user text messages through LINE Messaging API only when both `LINE_CHATBOT_MODE=live` and `LINE_CHATBOT_LIVE_APPROVED=true` are explicitly configured. This requires an approved operational change, a valid channel access token, webhook configuration, and provider testing. Do not set these values as part of a routine deploy.

The provider API key is runtime secret material. Keep it in the deployment secret store, never in source control or logs. Email, phone-like numbers, and LINE user IDs are redacted from the question before a provider call. The default model is configurable. Google currently lists [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/pricing) with a free tier, but provider account eligibility/rates can vary; the provider free tier also states submitted content may be used to improve its products, so do not send sensitive tenant/account or payment data. The automated tests use mocked provider responses and do not demonstrate real LINE or AI provider acceptance.

## Operational validation

- Unit tests: `corepack pnpm --filter @apartment/api exec vitest run tests/line-help-rag.test.ts tests/line-oa.test.ts tests/org-notifications.test.ts`
- Migration is `apps/api/drizzle/0022_clean_the_call.sql`; apply it only through the normal migration pipeline after an isolated PostgreSQL migration check.
- Verify notification recipient isolation with separate signed-in users during UAT.
- Keep the chatbot disabled until the API key is configured and an operator approves live LINE replies.
