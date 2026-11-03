# P1-03 (partial) — Effective-dated Room Tariffs and Move-in Proration

Status: DEV implementation (2026-11-03). This completes P1-03a and P1-03b
only. Meter replacement, mid-cycle move-out billing, deposits, and tenant
legal notices remain pending. Never label all P1-03 or Production complete.

## P1-03a room overrides with immutable history

Migration 0013 creates room_rate_versions, backfills each existing room's
current overrides into a 1900-01-01 MIGRATED_BASELINE, and seeds newly inserted
rooms through a PostgreSQL AFTER INSERT trigger. Old invoices remain unchanged;
the initial baseline cannot reconstruct any historical override changes from
before this migration.

New scoped APIs:
- GET /v1/properties/:propertyId/rooms/:roomId/rates
- POST /v1/properties/:propertyId/rooms/:roomId/rates

A POST requires an active OWNER membership, full nullable override values
(rentOverrideSatang, waterOverrideSatang, electricOverrideSatang), a future
effectiveFrom at a canonical billing-period start, and a 12–500-character
reason. NULL means inherit the as-of property master rate. Utility charges
must not exceed the Super Admin reviewed tariff ceiling, including inherited
rates. Previously issued future invoices and duplicate or older schedules
block changes. Updates use the property transaction lock shared with billing,
plus a room row lock and immutable audit event.

Existing PATCH room override fields now return
ROOM_OVERRIDE_REQUIRES_EFFECTIVE_DATE; room number changes still work.
The Room owner UI schedules dated changes and offers an on-demand rate
history. Room list reads project the currently active version rather than
altering the legacy room baseline columns.

New invoices resolve property master and room overrides as of the exact
billing period START. RENT/WATER/ELECTRIC snapshots store both
masterRateVersionId and roomRateVersionId, their effective dates and actual
MASTER/OVERRIDE source. Existing invoices and their financial ledger are
not repriced, even when rates are scheduled or become effective later.
Crossing a rate change in a single invoice remains forbidden until robust
multi-rate proration is designed.

## P1-03b guarded partial move-in invoices

The existing POST /v1/properties/:propertyId/bills/preview and /bills/issue
accept optional partialMode: "MOVE_IN".

This mode is valid ONLY when:
1. The lease is ACTIVE and starts exactly on the requested invoice start;
2. The invoice begins strictly inside one canonical billing period;
3. The invoice endExclusive equals that period's full end boundary;
4. Both water and electricity readings exist on invoice start and end;
5. The property and room rate versions valid for this interval pass existing
   rate/compliance/financial guards.

Rent is prorated using the domain's calendar-day satang calculation. Water and
electricity are charged from actual boundary readings. The RENT invoice line
snapshot records partialMode. Invoice issue is idempotent and uses the property
lock; an additional lease-level interval-overlap check denies another ISSUED
invoice covering any of the same dates. Preview is non-mutating.

The Billing UI offers explicit full-period versus move-in-partial mode.
MOVE_IN does NOT allow arbitrary date slices, mid-cycle move-out, meter
replacement, credits, refunds, or automatic deposit settlement. Reject rather
than guessing whenever dates, readings or billing cycle are inconsistent.

## Verification and outstanding work

- Unit tests: tests/room-rates.test.ts and tests/billing-partial.test.ts,
  including monthly, semi-monthly and rolling-15-day boundary cases.
- Real PostgreSQL HTTP tests: scripts/smoke-http.ts validates rate baseline
  migration trigger, owner vs manager authorization, date/legal cap/duplicate
  rejection, old invoice immutability, new override snapshots, actual move-in
  proration, nonexistent end-date guard and duplicate invoice protection.
- Regression: all workspace unit, typecheck, web build, HTTP, payment, finance,
  S3 mock, LINE consent/outbox and cleanup smoke, Docker Compose validation.
- Pre-migration local PostgreSQL backup SHA-256 verified. Migration 0013 adds
  one public table. The live sender remains disabled in DEV.

Remaining P1-03c: meter swap events (old/new serials, closing/opening
readings, continuity across multiple replacements), a safe move-out
partial/final invoice contract, occupancy/deposit/refund policy and legal
review; P1-04 staff membership and P7 load/security UAT are also open.
