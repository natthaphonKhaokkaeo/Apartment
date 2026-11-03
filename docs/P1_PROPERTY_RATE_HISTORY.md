# P1-02 — Property Master rate history (DEV)

Implemented and deployed on 2026-11-03 at https://apartme.makemarket.space.
Feature commit: 2b6897e. This is not Production or legal tariff approval.

## Data model
Migration 0012 creates `property_rate_versions` with organization/property scope,
effective date, three integer-satang price fields, reason, actor and timestamp.
It seeds all preexisting properties with an initial baseline effective
1900-01-01 and installs an insert trigger for new properties. The existing
`properties` price columns remain legacy baselines; property list read models
project the current active rate from version history. No old invoice is modified.

## API and rules
GET /v1/properties/:propertyId/rates — scoped read, latest versions first.
POST /v1/properties/:propertyId/rates — active organization OWNER only.
Requires the complete rentSatang, waterSatangPerUnit, electricSatangPerUnit,
effectiveFrom (YYYY-MM-DD) and reason (12–500 characters).

The effective date cannot be before the current Asia/Bangkok date and must
begin a full billing interval (monthly day 1; semi-monthly days 1/16; rolling
15-day exact anchor multiple). A newer version cannot duplicate or overwrite
an existing scheduled one. A water/electric increase cannot exceed the
Super Admin reviewed tariff ceilings. Issued invoices covering the proposed
new effective date or later block the schedule.

The rate write and audit entry share one PostgreSQL transaction and lock the
property row, as does invoice issuance. Future billing preview and issue
resolve the rate effective at the period start; if a period crosses another
rate boundary, billing fails until P1-03 supports proration. RENT/WATER/
ELECTRIC immutable invoice-line snapshots now store masterRateVersionId,
masterEffectiveFrom and actual MASTER/OVERRIDE source.

## Operator and QA notes
Owner Settings includes a form to schedule changes and a tariff history table.
Already-issued invoice totals, payment ledger and prior PDF snapshots never
recalculate. Legacy invoices pre-P1-02 retain their original snapshots without
retroactively invented version IDs. Per-room overrides remain immediate until
P1-03 introduces dated override history.

Pre-migration PostgreSQL backup and checksum verified. Drizzle migration 0012
applied, resulting in 26 public tables; generating the schema again reports no
changes. 66 unit tests (11 domain, 55 API), PostgreSQL HTTP rate-history and
old/new price previews, payment, finance, LINE, S3 mock, cleanup, typecheck,
frontend build and Compose config all passed. HTTPS /readyz=200 and missing
authentication returns 401 on rate endpoints. DEV LINE outbound remains off.

Pending: P1-03 partial tenancy/proration, dated room overrides, meter
replacement, formal price-change notices, scheduled-price correction policy,
external provider E2E and Production security/legal acceptance.
