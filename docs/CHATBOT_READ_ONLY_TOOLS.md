# LINE OA role-scoped read-only answers

## What is implemented

Incoming LINE text is classified by the configured AI provider to a short Thai question and optional *tool name*. Only a closed, named catalog is accepted by the backend (`apps/api/src/services/line-read-tools.ts`); no generated SQL, table name, arbitrary ID, property filter, write operation, or executable code is accepted. There is a conservative local-language fallback when the provider does not return a usable tool. Each database read uses the webhook's already verified LINE subject and binding organization, not the model's text. The tool service independently re-checks current user, organization and active role membership.

| Tool | Who can use | Answer content |
| --- | --- | --- |
| `PROPERTY_COUNT` | OWNER, MANAGER, SUPER_ADMIN | Count of properties in bound organization |
| `ROOM_STATUS` | OWNER, MANAGER, SUPER_ADMIN | Room counts by status |
| `ROOM_LOOKUP` | OWNER, MANAGER, SUPER_ADMIN | Room status in the bound organization; room number extracted from original question; multiple buildings disambiguated |
| `LEASE_STATUS` | OWNER, MANAGER, SUPER_ADMIN | Lease counts by status |
| `INVOICE_STATUS` | OWNER, MANAGER, SUPER_ADMIN | Issued/void invoice counts; **not** a statement of outstanding debt |
| `MAINTENANCE_STATUS` | OWNER, MANAGER, SUPER_ADMIN | Repair ticket counts by status |
| `LINE_DELIVERY_STATUS` | OWNER, MANAGER, SUPER_ADMIN | LINE outbox delivery status counts without recipient/message content |
| `PAYMENT_CLAIM_STATUS` | OWNER only | Submitted payment-claim counts by status; no super-admin bypass |
| `MY_INVOICE` | TENANT only | Own issued invoices/outstanding figures, based on active leases linked to verified LINE subject; never sent to LLM |
| `MY_REPAIR` | TENANT only | Own recent maintenance ticket titles/statuses for linked active leases; never sent to LLM |

All sensitive/personal records remain outside model prompts. When the backend cannot perform an authorized read, it fails closed without generic AI guessing. The model only sees curated, role-approved help guides and administrator aggregate summaries; its generated response is scrubbed for credential/PII patterns. Unfamiliar/off-topic requests ask for a narrower question instead of returning irrelevant documentation. The chatbot cannot modify invoices, perform financial adjustments, retrieve secrets, or grant permissions.

## Manual DEV verification checklist

- OWNER asks "ตอนนี้ห้องว่างกี่ห้อง", "ห้อง A-101 ว่างไหม", "LINE ส่งแจ้งเตือนบิลไปกี่รายการ" and gets scoped counts or a precise not-found response.
- OWNER asks "มีสลิปค้างตรวจสอบกี่รายการ"; MANAGER asks the same and is denied.
- TENANT asks "ยอดค้างของฉันเท่าไหร่" and "ซ่อมที่แจ้งไปถึงไหน"; responses may only include their own active LINE-linked leases.
- PUBLIC and STAFF try OWNER-only queries; no data is returned.
- Any role asks for API key, passwords, ENV values or another tenant's bank details; none are revealed.
- Unrecognized question with no relevant help articles returns a request to clarify instead of unrelated generic material.
- Run tests, lint and typecheck before production approval. For real LINE delivery E2E, send a genuine message from an authorized test LINE account and verify in app logs without outputting its raw text or user ID.

## Explicit limitations

Read-only tools support the named domains and aggregates above, not arbitrary raw database reporting. For detailed financial position of another account, refunds, exact tenant identity or changes to stored records, use the role-authorized web UI and its separate transaction controls. AI responses must not be treated as account statements or a way around authorization.
