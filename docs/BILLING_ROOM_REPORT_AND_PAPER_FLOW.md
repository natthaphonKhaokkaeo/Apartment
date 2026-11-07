# Paper billing, room-level invoice report and optional meter photo — 2026-11-07

## Billing without inviting the tenant

An OWNER can create a lease with a tenant name, room and start date **without** a linked LINE user or invitation. Record the period boundary water and electricity readings, then issue a single-room invoice or a batch. A tenant LINE account and opt-in consent are NOT required for creating an invoice or downloading the private PDF. The LINE notification queue is deliberately skipped when the tenant is not linked or has not consented. Printed invoices are **payment notices, not receipts or tax invoices**.

## Owner dashboard and room report

- Existing Dashboard: selected property, occupied/empty rooms, billed amount, owner-confirmed payments and outstanding amounts.
- New `รายงานบิลรายห้อง` owner navigation: filter by room, billing-period start dates and ISSUED/VOID; see historical issued and void invoices, billed/paid/outstanding amounts calculated from the accounting ledger, and correction lineage.
- The report is strictly scoped to property and organization on the server, checks active OWNER membership and limits each query to 250 records; a banner indicates truncated results.
- `ออกบิลใหม่` opens the existing single/batch issuance. `แก้ไขและออกใหม่` opens the existing owner-only Void & Reissue with the selected invoice. Paid or evidence-touched invoices remain blocked by the financial guards.
- For ISSUED invoices only, open inline PDF to print, download PDF, generate/save PNG locally in the browser, or share a PDF `File` through the OS share sheet when supported. Unsupported share APIs fall back to a local file download. No publicly accessible URLs, third-party screenshot services or insecure sharing of tenant data are created. VOID invoices remain report-visible but cannot be exported as payable notices.

## Optional meter photo and custom invoice note

- Meter values are required; **meter photographs/documents are optional**. The reading API accepts room, type, date and value without an upload. The separate evidence/photo form is explicitly labeled optional. Missing evidence alone cannot block the ordinary billing calculation.
- Single-room and bulk billing accept optional `note` (plain text, up to 300 characters), visible in preview. Notes persist as immutable `NOTE` invoice lines with `amount_satang=0` and are shown on PDF/PNG without changing the total.
- Void & Reissue preserves the previous note by default and allows an OWNER to enter an optional replacement note at preview/reissue confirmation. The note is part of the signed correction preview, so an altered note requires a new preview.
- Existing invoices are immutable; adding notes to an issued invoice uses the guarded reissue workflow rather than editing its original line items.

## Acceptance and safety checks

- Issue an invoice for an ACTIVE manual lease without a linked tenant LINE account; verify the PDF is downloadable/printable and there is no unauthorized LINE push.
- Check the report for two distinct property owners; an owner must never see the other organization's tenant name or invoice. Anonymous, STAFF and cross-org calls must fail.
- Check manual paid, part-paid, void, reissued and unlinked-tenant cases without changing real tenant billing data. Outstanding must not include VOID invoices.
- Check note text and final satang total on PDF and PNG; verify exports on Chrome/Android and Safari/iOS share-sheet support.
- Confirm meter readings can be recorded and invoiced without uploading a photo; reject invalid meter readings and out-of-bounds note text.

## Known boundaries

- Receipt/tax-invoice issuance, refunds, paid-invoice reversals and public share links are not introduced.
- Browser image export depends on Canvas and may be unavailable on extremely old browsers; a protected PDF remains available as fallback.
- The per-room report intentionally limits results to avoid large unbounded financial queries; choose filters to narrow the report.
