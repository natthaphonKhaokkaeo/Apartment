# P3-05 Document and Receipt Contract — Specification (Not Implemented)

State: **Requirements/spec prepared; PDF renderer, receipt issuance, tax invoice legality and E2E remain pending.** No official receipt is generated or authorized by the current code.

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
- Keep P3-05 unchecked until legal issuer details, PDF implementation, E2E and compliance signoff are complete.

## D. Product decisions still required

- Landlord/organization legal name and tax identification, VAT/withholding status, permitted invoice nomenclature
- Whether rent is prepaid/postpaid, due-day rules and how mid-period changes are handled
- Receipt issuer, official numbering series, correction and refund/credit policies
- Personal-data retention, consent and Thai tenancy/legal signoff
