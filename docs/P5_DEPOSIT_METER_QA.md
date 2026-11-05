# P1/P5 deposit and meter evidence — DEV implementation checkpoint

## Implemented and locally verified

- Migration 0018 adds deposit receipt/deduction ledger and two-owner review records, bounded integer satang, scoped idempotency/reference uniqueness, positive amount/source checks and an UPDATE/DELETE-blocking ledger trigger.
- Deposit API rechecks active user, organization and OWNER membership under transaction locks. No Manager or platform-admin shortcut. Property -> lease locks serialize receipts, pending reservations and decisions.
- Receipt entries are explicitly manual records, not bank-confirmed funds. A deduction requires a distinct active OWNER and posts once. Refund/dispute approval reserves money but never initiates payout or silently offsets rent debt.
- Policy regression: 14/14. Disposable PostgreSQL smoke proves 3-way receipt replay, strict amount validation, duplicate reference, scope denial, 3-way single debit, concurrent over-reservation denial, dispute rejection release, disabled-owner denial and actual DB ledger immutability.
- Migration 0019 adds private meter photo metadata and append-only anomaly-review API records. Upload requires OWNER/MANAGER or an active per-property METER_READER grant; VIEWER may read but cannot upload. Anomaly review requires active OWNER membership.
- Images reuse the existing bounded sanitation/storage/scanner adapters. MIME must match decoded JPEG/PNG/WebP; at most 4 MB and 12 MP, single-frame pixels only, metadata stripped, private WebP output. Source and sanitized bytes pass the configured scanner adapter. Disabled DEV scanner is explicitly NOT_SCANNED_DEV, never CLEAN.
- No public storage keys or signed public GET URLs are returned. Reads recheck scoped access and return no-store image/webp through the API. Idempotent photo retries compare sanitized checksums; unused newly created files are removed on replay/failure.
- Owner anomaly reviews snapshot the actual current/previous reading, meter replacement marker and owner-entered daily threshold. Advisory classifications never modify readings, invoices or financial state.
- Meter HTTP smoke passes grant/IDOR/revoke, MIME/size, private image sanitation, matching checksum, retry hash guard and persisted owner assessment.
- Backend-connected browser suite passes 12/12 over desktop/390px/320px. Owner workflow now includes real deposit receipt/review, two meter readings, private photo upload/render and persisted anomaly review. It seeds verified test sessions only in a disposable DB; no application auth bypass exists.

## Recovery verification

Fresh custom PostgreSQL backup encrypted locally and SHA-256 verified. Encrypted-only restore recovered 32 source public tables in networkless disposable PostgreSQL. Latest upgrade rehearsal applies migrations 0018 and 0019, verifies all 32 original-table content fingerprints, then restores the original backup/schema. No live database migration has been applied at this checkpoint.

## Notification producers

Repair status transitions enqueue generic MAINTENANCE_UPDATED events transactionally only for an exact active lease/OA/consent match. Status replays and concurrent same-status transitions do not duplicate events. Invalid transitions and revoked consent do not enqueue. Generic text omits ticket title/description and amounts.

Current explicit consent wording includes bills, due dates and repairs only. TENANT_LINK_APPROVED producer is deliberately INELIGIBLE under that policy; it does not expand consent, send invitation secrets or dispatch messages. Invitation delivery requires a separately approved consent purpose and user flow. All live outbound remains disabled; provider GET bot/info returned 200 with configured bot identity matching, without external messages.

## Open boundaries

Actual deposit refund transfer/reconciliation, resolving approved refund/dispute reservations after external handling, statutory documents and legal retention are not claimed implemented. No automated ledger deletion or actual cash transfer is enabled. Scanner/provider, privacy erasure/contract policy, design acceptance and real LINE/bank UAT remain separate gates.

Release regression, Git integration and DEV application rollout are tracked in the current master status; this checkpoint alone is not 100% readiness.
