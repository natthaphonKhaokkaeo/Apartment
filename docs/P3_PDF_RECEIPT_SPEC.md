# P3-05 Billing Notice (Implemented in DEV) / Official Receipt Contract (Pending)

State (2026-11-03): **Informational Billing Notice PDF and scoped downloads are implemented and tested in DEV.** Official payment receipts, tax invoices, legally verified issuer/tax data, bank settlement confirmation and Production release are **not implemented**.

Available routes:
- GET /v1/properties/:propertyId/invoices/:invoiceId/billing-notice.pdf — authorized property owner/staff
- GET /v1/tenant/invoices/:invoiceId/billing-notice.pdf — linked active tenant with an issued invoice
Both return authenticated, private no-store PDF attachments; no public URL. New invoices capture issuer/property/address/room/tenant names into document_snapshot at issue time. Old invoices display an explicit current-record metadata warning. Financial amounts always come from immutable invoice_lines. Fonts are Noto Sans Thai from an npm dependency, embedded at runtime, without extra ENV.
PDFJS text extraction and raster review passed for one-page and seven-page DEV samples.

## A. Document distinction

1. **ใบแจ้งหนี้ / Billing Notice** — may be generated from immutable invoice and line-item snapshots as an informational document. Must display `ไม่ใช่ใบเสร็จรับเงินหรือใบกำกับภาษี`, period, invoice ID, property/room, rent/water/electric breakdown in integer satang, due date, and display-only bank instructions if enabled. Do not imply a bank has confirmed payment.
2. **ใบรับเงิน / Receipt** — only issue after financial policy, legal issuer/tax details, bank reconciliation rules, authoritative payment confirmation and immutable receipt numbering have been approved. Current owner manual approval is NOT independent bank verification.
3. **ใบกำกับภาษี / Tax invoice** — must be separate opt-in legal workflow after Thai legal/tax review. Do not hardcode VAT 7%, assume entity is VAT-registered, fabricate taxpayer ID, or claim electronic-tax compliance.

## B. Proposed future data contract

- `document_id`: generated UUID; `organization_id` and `property_id` scope.
- `invoice_id` required; `payment_ledger_id` required **only** for confirmed receipt.
- `document_type`: BILL_NOTICE | PAYMENT_RECEIPT | TAX_INVOICE | CREDIT_NOTE.
- `document_number` unique per issuer/year/type; allocated transactionally with series locking.
- Issuer snapshot (legal name, address, optional tax/VAT registration info), customer snapshot if consented.
- CreatedAt in UTC, formatted in Asia/Bangkok (calendar-year choice explicitly documented).
- Currency THB, integer satang totals, unambiguous calculation/rounding, invoice line snapshots, payment refs only where legally appropriate.
- `document_sha256`, renderer version, template version, `storage_key` private, signer, audit actor, issue timestamp, void/revision links.
- Revocation/credit-note policy, corrections via new document, never silently rewrite issued PDFs.

## C. Security and UX requirements

- Enforce authorized owner/tenant property and invoice scope before PDF download.
- Use embedded Thai-capable font with suitable license; no fonts sourced from user or shared with external parties.
- Text reflow for long Thai names/addresses, A4 page margins, page count, footer and accessibility contrast.
- No public PDF URL. Private storage + authorized download with no-store.
- Golden-file tests for rent, water/electric, override, discount, multiple pages, empty fields, Thai glyph coverage, total invariants and IDOR.
- Render PDFs to images and inspect for clipping, tofu/missing Thai glyphs and overlap before release.
- Clearly distinguish financial source status: manual owner approval vs verified bank settlement.
- Keep P3-05 **overall unchecked** until official receipt/tax identity, numbering, financial validation and legal signoff pass. P3-05b informational PDF is checked in PHASES.md.

## D. Product decisions still required

- Landlord/organization legal name and tax identification, VAT/withholding status, permitted invoice nomenclature
- Whether rent is prepaid/postpaid, due-day rules and how mid-period changes are handled
- Receipt issuer, official numbering series, correction and refund/credit policies
- Personal-data retention, consent and Thai tenancy/legal signoff
