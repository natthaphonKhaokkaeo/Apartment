# P3-04b — Financial correction workflow

**2026-11-03 DEV:** Implemented internal credits, manual-payment-record reversals, and requests for refund/dispute review. **No real refund, no official credit/tax note, no bank reconciliation, no funds transfer.**

- Every request is scoped to verified property/org and must originate from an active **OWNER**.
- Approval/rejection requires a **second distinct active OWNER**; MANAGER and platform-only Super Admin cannot bypass. A one-owner organization needs another genuine owner before approval.
- Requests have PENDING/APPROVED/REJECTED statuses, idempotency keys and immutable audit events.
- INTERNAL_CREDIT reduces receivable up to the currently outstanding balance; it is **not** a statutory credit note.
- REVERSE_MANUAL_PAYMENT must reference and fully reverse a previously approved ledger posting exactly once. Original payment_ledger entry is **not modified**, and a new finance_adjustment_entries record is appended. This corrects the manual accounting record, **not bank activity**.
- REFUND_REVIEW can be approved for further investigation only up to current manually approved payments. **No payout** is executed, no payment entry posted; response `transferExecuted:false`.
- DISPUTE_REVIEW records review status only, with no financial balance or bank status change.
- Invoice row locks serialize concurrent finance approval and payment posting. Effective applied amount = net manual payments + internal credits; Dashboard and tenant summaries distinguish them. All amounts integer satang.

**Endpoints:**
- `GET /v1/properties/:propertyId/finance-adjustments`
- `GET /v1/properties/:propertyId/invoices/:invoiceId/finance-context`
- `POST /v1/properties/:propertyId/invoices/:invoiceId/finance-adjustments` (requires idempotency-key)
- `POST /v1/properties/:propertyId/finance-adjustments/:requestId/decision` (different owner, reason)
- Existing scoped payment-summary includes adjustment breakdown. Payment Center UI supports requests/reviews.

Drizzle migration `0008`: `finance_adjustment_requests` and `finance_adjustment_entries`. Test with `corepack pnpm --filter @apartment/api smoke:finance` against DEV PostgreSQL, plus unit tests.

**Still pending:** official statutory credit notes/receipts, refund bank account validation, actual refund payment and bank reconciliation, evidence/case management and legal/compliance acceptance. Overall P3-04b remains **PARTIAL**.
