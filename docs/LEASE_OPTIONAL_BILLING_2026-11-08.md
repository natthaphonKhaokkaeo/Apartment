# Lease-optional room billing — 2026-11-08

## Problem

Single-room billing returned `FULL_PERIOD_ACTIVE_LEASE_REQUIRED` whenever no active lease covered the entire period. The same assumption lived in the `invoices.lease_id NOT NULL` database constraint, the bulk billing gate, and inner joins in owner invoice reports. A frontend-only fix would fail at insert time or hide new invoices from the owner.

## Decision and implementation

- Standard room billing is **room- and cycle-based**, not contract-based. Any scoped property room can be selected for a single room invoice (including AVAILABLE rooms), regardless of whether it has a registered lease.
- When an ACTIVE lease covers the entire ordinary period, associate it with the invoice as before. If no lease covers the full period, save `lease_id=NULL`; never fabricate a lease or label the invoice with a tenant whose contract is not applicable to the complete period. The immutable PDF document snapshot uses `tenantName="ไม่ระบุผู้เช่า"` in this case.
- Explicit MOVE_IN and MOVE_OUT prorated modes retain an actual active lease requirement, because the specialized formulas must validate the real move dates. Users can select the **normal period** for rooms without leases.
- Invoice duplicate and overlap checks use **property room + period** instead of lease ID for both single-room and batch billing. Add a partial unique database index `uq_invoice_room_period` on `(room_id,period_start,period_end)` for ISSUED invoices. The old lease-period index remains for compatibility. No two unrelated tenant contracts can accidentally produce duplicate issued invoices for one room and period.
- Bulk billing no longer skips an OCCUPIED room merely because no active lease is registered. It still selects OCCUPIED rooms only, intentionally avoiding automatically charging all vacant rooms. To issue a bill for an AVAILABLE room, choose it in the single-room billing form.
- Owner `invoice-room-report` uses a LEFT JOIN to leases and supports NULL tenant labels. The tenant-specific endpoints continue to expose only invoices associated with that verified tenant's own lease. The owner-only receivables and management views remain property-scoped.
- Tenant LINE notification requires a verified lease/recipient binding; lease-less invoices are not sent to an arbitrary LINE user. Tenant uploads/payment claims for an invoice with no lease remain unavailable, while owner-side invoice and payment management continue to operate on the invoice ID.
- Invoice corrections preserve a nullable lease ID and the original immutable document snapshot. Legacy PDF fallback tolerates NULL leases safely.

## Migration

`apps/api/drizzle/0025_careful_argent.sql`:

1. `ALTER TABLE invoices ALTER COLUMN lease_id DROP NOT NULL;`
2. Create `uq_invoice_room_period` unique partial index for `status='ISSUED'`.

Before migration, inspect existing ISSUED invoices for duplicate `(room_id,period_start,period_end)` groups and resolve any conflicts safely. On the current DEV database inspection, there were **zero** issued invoice rows and zero duplicate groups. Docker Compose applies checked-in migrations on API boot.

## Verification

- `apps/api/tests/billing-without-lease.test.ts` verifies optional lease identity, valid full-period association and move-in/out behavior.
- `corepack pnpm test` covers backend regression suites.
- `corepack pnpm --filter @apartment/web smoke:billing-ui` verifies the vacant-room/no-contract preview and issue interaction with mocked APIs; it does not modify actual invoices.
- `corepack pnpm --filter @apartment/web smoke:responsive` verifies the billing layout and other sections on mobile and tablet widths.
- Run lint, typecheck, web build and verify DEV API/Web health after migration and deployment.

**Important:** A room-only invoice has no tenant identity to authorize a tenant-facing payment claim or LINE recipient. Do not use fabricated tenant identity as a workaround. Use the owner-side payment reconciliation feature; an actual lease/tenant link is required before any tenant-facing automated notification can be enabled.
