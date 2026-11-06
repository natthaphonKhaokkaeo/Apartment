# Billing usability and correction gap review — 2026-11-06

## Verified existing behavior

- Bulk billing UI: `apps/web/src/components/BulkBillingCenter.tsx` supports date range, preview, owner approval, skipped rooms, and run history.
- Backend: `apps/api/src/routes/billing-batches.ts` validates dates, hashes previews, locks property/rooms, issues atomically, and supports idempotent approval.
- Database: `apps/api/src/db/schema.ts` has `uq_invoice_lease_period` on `(lease_id, period_start, period_end)`. A second invoice for the exact same lease and period currently violates this unique constraint, regardless of payment status.
- No implemented void/reissue workflow was found in billing batch routes. Existing financial adjustment endpoints must not be assumed to void or replace issued documents.

## Priority backlog

### P0: Correct issued invoices safely (not implemented)
1. Define `VOIDED`/`SUPERSEDED` semantics for unpaid invoices, separate paid/partially paid corrections and refunds/credit adjustments.
2. Add immutable invoice revision link (`replaces_invoice_id`, `replaced_by_invoice_id`, reason, actor, timestamps), preserve original document and line items; ensure unique active lease-period invariant with a partial index or revision design.
3. Create owner-authorized `preview-reissue` and `confirm-reissue` endpoints. Lock the original invoice and lease; reject payment/claim in progress; require correction reason, idempotency key and explicit confirmation; atomically supersede original and issue replacement.
4. Prevent old invoice payments, tenant views, reminder queues, and outbound LINE messages from treating a superseded invoice as payable; retain audit history and send correction notice only to eligible recipients.
5. Cover concurrent reissue vs payment, cross-organization access, paid/partially paid cases, duplicate clicks, rollback and stale previews with integration tests.

### P1: Billing UX
- A guided 3-step wizard: choose room(s) and period, inspect/edit eligible inputs, confirm and issue; preview total and line-item differences before commit.
- A searchable invoice list with payment status and prominent `Correct and reissue` action only when eligible.
- Explicit skipped-room explanations and inline links to missing lease/meter setup.
- Post-issue summary with printable bill, resend status, correction history, and clear warnings.

### P2: Operations and reporting
- Reconciliation dashboard for payments, reversals, corrected invoices and LINE delivery outcomes.
- Role-based approvals and event-based monitoring for repeated corrections or duplicate charge attempts.

## Current delivered change

The bulk-billing UI now shows a clearer three-step instruction, allows selecting any date range with client-side end-after-start validation, and explicitly warns against issuing a duplicate to correct an existing invoice. This is a UX improvement only; **the actual reissue feature is NOT implemented**.
