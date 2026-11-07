# Month-based meter readings and pre-invoice corrections (2026-11-08)

## User-visible behavior

- **จดมิเตอร์** and **ออกบิล** now offer the same monthly meter editor: select property room, month, meter kind (water/electric), and cumulative value. No freehand reading day is required for normal monthly invoices. Existing reading values are preloaded, and users can change a past month's value before invoices using it have been issued.
- Monthly invoice entries use the **closing reading of the selected month**. The stored `readAt` is the *exclusive* next-month-first boundary (e.g. November 2026 -> `2026-12-01`); `createdAt` is the real server record timestamp. These two dates have different purposes and must not be confused. No DB schema migration is required.
- A property on `SEMI_MONTHLY` or `EVERY_15_DAYS` cadence selects a month **and a predefined billing subperiod**. The backend validates the requested end boundary against the property's cadence/rolling anchor. This preserves accurate 15-day billing without manually typing a date.
- Re-entering a room/meter/month updates that period's existing canonical row, rather than returning `DUPLICATE_READING`. Each CREATE/UPDATE is audited with actor, previous value, new value, month, room and meter kind. Original `createdBy` / `createdAt` are preserved when updating. A legacy `readAt` input remains supported for integrations, but cannot overwrite a day in place; use `month` for month-based edits.
- Readings for another month are **not compared when storing**. A correction to an earlier month can be numerically lower than a reading saved in a later month; saving no longer fails with `NON_MONOTONIC_READING` for this reason.
- Monthly bill calculation resolves a boundary's exact dated reading first. When absent, and the boundary is the first of a month, it uses the latest actual `readAt` from the immediately previous calendar month (backward compatibility with older day-based readings). The same physical reading ID and raw values are recorded in immutable bill-line snapshots, with `startReadingDate` / `endReadingDate`. Partial/mid-month boundaries still require exact dated readings, preventing accidental charge allocation to the wrong half-period.
- The *initial* meter baseline may be zero only when there are no earlier readings or replacement records. Billing with decreasing physical values and no recorded meter replacement fails with a dedicated `METER_BILLING_READING_DECREASED` explanation rather than generating a negative or fictitious charge.
- Before issuing any real single/batch invoice, the operator can edit meter values directly from the **ออกบิล** page. Saving resets both single-room and batch PREVIEW state. The operator must compute the invoice again before approval.

## Safety and audit invariants

- Changes are serialized with invoice issuance using the same `properties` row lock. Active organization and tenant/property/role access are checked inside the transaction, including Super Admin. Rooms are locked to serialize competing writes.
- Any issued or historical invoice that ends on or after a reading's closing boundary blocks changing that reading (`METER_READING_USED_BY_INVOICE`). Correct an issued bill via the dedicated void/reissue process instead of altering its source data. This conservative rule also protects invoice history and later periods dependent on the opening reading.
- Physical meter-replacement boundary readings are immutable via monthly edits (`METER_REPLACEMENT_BOUNDARY_LOCKED`): use the meter-replacement workflow, not a normal meter edit, when hardware changes.
- Only authorized property staff granted meter-write permissions (or owner/manager/Super Admin through verified property scopes) can write. Editing readings never directly issues an invoice or sends a LINE message.
- The underlying `meter_readings` table remains unique on `(room_id, kind, read_at)` and uses an idempotent update within its locked transaction for monthly entries. The full audit is stored separately in `audit_logs`.

## Tests

- Unit: `apps/api/tests/meter-monthly.test.ts`, `apps/api/tests/meter-periods.test.ts`, `meter-initial-baseline.test.ts` and existing billing, meter and replacement suites.
- Browser: `corepack pnpm --filter @apartment/web smoke:billing-ui` covers single/bulk previews, editing a past month, invalidating previously computed previews, and selecting a 15-day subperiod. All APIs are mocked; no live tenant invoices change.
- Responsive: `corepack pnpm --filter @apartment/web smoke:responsive` covers the 14 application sections with mobile/tablet/desktop browser viewports.
- Full: `corepack pnpm test`, `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm --filter @apartment/web build`.

## UAT cases to verify on real authorized test data

1. Set a historical month to a value below a newer month's reading; save succeeds, audit has both old/new.
2. Preview a monthly invoice: opening = latest previous-month close (or first-ever zero), closing = latest month close. Both meter types have correct nonnegative unit consumption.
3. Edit a meter via Billing before issuing: both previews must become invalid and require recomputation.
4. Try editing a meter after invoicing or at a physical replacement boundary: access is blocked, with no mutation.
5. Test `SEMI_MONTHLY` (1st/2nd half) and `EVERY_15_DAYS` (rolling anchor) with correct per-cycle readings; no mistaken use of an unrelated month's meter.

Do not use financial production data for automated UAT invoice creation; use a dedicated test property and confirmed consent for live notifications.
