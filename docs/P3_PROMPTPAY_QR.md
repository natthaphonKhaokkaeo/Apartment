# P3-01b — Thai PromptPay QR (DEV implementation)

**Status (2026-11-03):** Implemented and tested using BOT/EMV standard and a published golden vector, with owner/tenant HTTP authorization and a local QR PNG renderer. **Real bank mobile-app scan and account-registration verification remain unverified.** No Bank API, payment gateway, automated settlement, receipt or tax invoice.

## Reference / encoding

Official Bank of Thailand policy and Thai QR Payment Standard (Annex 1, tag 29): https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/ThaiPDF/25620084.pdf

Merchant-presented PromptPay Credit Transfer:
- Tag 00 = 01; Tag 01 = 12 with **fixed invoice outstanding amount**.
- Tag 29 contains sub-tag 00 (AID **A000000677010111**), plus exactly one registered proxy subtag: 01 for mobile phone, 02 for national/tax ID.
- Mobile number must be a 10-digit Thai mobile beginning 06, 08 or 09 and is encoded as 0066 + the final nine digits (13 characters total). 13-digit national/tax identifier passes format validation, **not bank-registration verification**.
- Tag 58 = TH; tag 53 = 764 (THB); tag 54 = decimal **amount with two digits**, computed from integer satang (never binary float arithmetic); tag 63 is CRC-16/CCITT-FALSE with 0xFFFF initial value and polynomial 0x1021.
- Code generates CRC locally; published test vector for mobile **0812345678** and THB 100.00 yields **BB8A**.
- QR image is rendered by \`qrcode\` locally in the browser; no third-party image-generation service receives the recipient identifier or invoice amount.
- Existing property bank account number **cannot** be substituted as a PromptPay proxy. The bank-account sub-tag requires a separate bank code/contract and is intentionally unsupported.

## Backend API

- \`GET /v1/tenant/invoices/:invoiceId/promptpay-qr\`: authenticated LINE-linked active lease, matching property/org, issued invoice.
- \`GET /v1/properties/:propertyId/invoices/:invoiceId/promptpay-qr\`: authenticated property-scoped owner/staff for review.
- Response: \`payload\`, \`amountSatang\`, \`currency: "THB"\`, \`recipientName\`, \`promptPayIdMasked\`, \`paymentSettingsVersion\`, flags \`recipientVerifiedByBank:false\`, \`paymentVerifiedByBank:false\`, \`status: "DISPLAY_ONLY_MANUAL_REVIEW"\`.
- \`Cache-Control: private, no-store\` because the payload contains the real registered proxy ID even though the display mask hides it.
- 404 when recipient ID is missing or account is inactive; 422 when malformed stored ID; 409 when invoice is fully recorded or a payment claim remains pending, to reduce accidental duplicate transfers.
- Amount is \`invoice.amountSatang\` minus **manually approved** ledger postings, in integer satang. It is NOT independently bank-reconciled.
- Owner settings: accept only a Thai mobile (10 digits) or tax/national ID (13 digits), still require optimistic version check and audited authorized changes.

## Frontend

- Tenant invoice payment screen displays the QR, masked proxy ID, configured account name, fixed outstanding amount, manual-payment disclaimer and download/refresh buttons.
- Owner Payment Center has an invoice selector and the same scoped QR preview for checking the receiving identifier before sharing it.
- Browser paints QR pixels locally and never sends a payload to external QR generators. Recheck the destination/name and exact amount in a banking app **before** pressing transfer.
- Never automatically record a transfer just because a QR has been viewed, saved, generated or scanned; existing evidence submission + owner manual review remains required.

## Verification (DEV)

- Unit: published vector, mobile normalization, 13-digit ID, CRC, invalid proxy, invalid/zero/negative/non-integer/overflow amount, masks.
- Real PostgreSQL / HTTP smoke: disabled/missing settings, owner and linked-tenant 200; outsider 404, unauthenticated 401, cross-property 403, invalid ID rejected, pending-claim QR blocked, partial approved amount changes, fully recorded invoice blocked.
- React production build and \`qrcode.toDataURL\` PNG smoke passed.
- **Pending outside DEV:** perform a real cross-bank app scan test (at least two supported banks or independent sandbox scanner), verify the configured PromptPay ID is actually registered to the expected recipient name, check LIFF on HTTPS, and review fraud/overpayment policy. Do not make transfer claims from test vectors alone.

## Operational config

No additional ENV or external API key required for this phase. The authorized property owner sets their PromptPay ID in the UI; do not put banking or national ID details in .env or git. LINE Channel/LIFF environment configuration remains a separate sandbox gate.
