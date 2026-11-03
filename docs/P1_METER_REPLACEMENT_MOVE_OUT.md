# P1-03c — Meter Replacement and Partial MOVE_OUT (Apartment DEV)

Status 2026-11-03: implemented and verified in PostgreSQL tests. This is a
DEV billing/occupancy workflow, not legal meter certification or deposit settlement.

## P1-03c.1 Physical meter replacement history

Migration 0014 creates meter_replacements with immutable room/property/org scope,
kind (WATER/ELECTRIC), replacedAt, oldSerial/newSerial, oldClosingValue,
newOpeningValue, operator-provided evidenceRef, reason, actor and timestamp.
No old readings, invoices or ledger rows are changed.

Owner endpoints:
- GET /v1/properties/:propertyId/rooms/:roomId/meter-replacements
- POST /v1/properties/:propertyId/rooms/:roomId/meter-replacements

Example POST:
{
  "roomId":"<matching UUID>","kind":"WATER",
  "replacedAt":"2026-11-02","oldSerial":"W-OLD-001",
  "newSerial":"W-NEW-002","oldClosingValue":"125.000",
  "newOpeningValue":"3.000",
  "evidenceRef":"internal-evidence-reference",
  "reason":"Meter hardware replaced after inspection"
}

The actor must have an ACTIVE OWNER membership in the property organization.
The route checks property and room scope. The old/new serials must differ;
successive replacements must chain oldSerial to the previous newSerial.
The swap date must not be in the future, conflict with existing same/later
readings, or revise an already issued invoice's period. The recorded old
closing reading cannot be below the latest reading of the physical old meter.

The operation takes the same PROPERTY row lock used by billing, and a ROOM
row lock shared with normal meter reading entry. Within one transaction it
inserts a replacement event, a synthetic new-meter opening reading at the
replacement date, and an audit event. No external LINE calls are made.

A reading at the replacement date belongs to the NEW meter. Monotonicity is
checked only within the same physical meter segment; across a swap the
number may reset. Billing includes all swaps in (periodStart, periodEnd],
summing (old closing - previous reading) plus (new ending - new opening)
for each segment before applying the unchanged reviewed unit tariff. An
invoice-line snapshot references all replacement IDs and serials/boundaries.
For adjoining periods, a swap at the shared boundary belongs to the
ending period only (the new meter then starts at that boundary). This avoids
double charging. No evidence file is uploaded/verified by this API:
evidenceRef is a reference supplied by the operator; link it to a secure,
verified evidence storage workflow before Production.

The Meter owner UI includes a replacement form and on-demand history table.

## P1-03c.2 Final partial MOVE_OUT invoice

Existing invoice preview and issue endpoints now accept
partialMode="MOVE_OUT". The final interval is permitted only if:
- the active lease covers the requested invoice period;
- the invoice begins at a canonical billing-period boundary OR exactly at
  the lease's original start date;
- endExclusive is after start, strictly before the canonical period end,
  and no later than the current Asia/Bangkok date;
- both water/electric readings exist at the start/end boundaries;
- existing master/room rate versions do not change during the interval;
- no existing ISSUED invoice for the lease overlaps the requested interval.

Rent is calculated by calendar-day proration in integer satang. Water/electric
come from actual segment readings, including replacement events. The
immutable invoice snapshot records partialMode and the selected rates and
meter events. Issuing the invoice never ends the lease automatically.

After final invoice issuance, the original OWNER move-out operation still
requires: an exclusive end boundary matching that invoice, final water/electric
readings, every invoice fully settled, no pending claims/finance reviews and
physical handover confirmation. Then it ends the lease, releases or marks the
room MAINTENANCE, revokes invitations/notification consents and audits the
handover. It does NOT automatically refund deposits or write off any debt.

The Billing UI has an explicit MOVE_OUT option; a separate owner-confirmed
move-out action is still required once the last invoice is paid.

## Acceptance evidence and remaining work

- TDD tests: apps/api/tests/meter-replacement.test.ts and the MOVE_OUT
  cases in apps/api/tests/billing-partial.test.ts.
- Real HTTP/PostgreSQL test: apps/api/scripts/smoke-http.ts verifies
  OWNER-only meter replacement, no decreasing old closing, automatic new
  opening reading, segment consumption (100 to 125; then 3 to 8 = 30),
  immutable replacement snapshot and partial final invoice; unpaid
  move-out rejected, approved ledger enables closure to MAINTENANCE,
  and duplicate closure denied.
- Full tests, typecheck, React build, payments, finance, S3, cleanup,
  LINE and Docker Compose regression are required before rollout.
- A pre-migration PostgreSQL pg_dump, checksum and restore check are
  required before any release. Migration 0014 adds one public table.

OPEN Production gates: physical proof and tamper-resistant evidence storage,
consent/tenant notifications, disputed reading adjustments, deposit/refund
settlement, offsite encrypted PostgreSQL backup, real LINE/bank provider E2E,
load tests and independent financial/security QA. Never represent this DEV
workflow as legally certified meter readings or completed deposit settlement.
