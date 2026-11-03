# P4-03e — Conservative LINE Dispatch Reservation Retention

Checkpoint 2026-11-03: Manual bounded cleanup added and tested in DEV; in-flight LINE consent cancellation and real provider uncertainty remain open.

Dispatcher reservations deliberately count every provider attempt, including failed network attempts. For fair rate limiting, recent reservations must never be removed. This cleanup removes ONLY rate-reservation rows older than 30 days; it does not delete or requeue LINE Outbox jobs, incident alerts, consent, business data or audit logs.

Commands from repository root, with a specific organization ID:

    corepack pnpm --filter @apartment/api line:cleanup-reservations --organization-id=YOUR_UUID

The default is DRY_RUN: returns eligible count and deleted=0. To delete a small bounded batch older than 30 days, require explicit operator approval:

    corepack pnpm --filter @apartment/api line:cleanup-reservations --organization-id=YOUR_UUID --apply --confirm-retention-cleanup

Rules:
- Organization scope is required even in DRY_RUN.
- Retention must be between 30 and 365 days; CLI uses 30 days. Each apply deletes at most 100 rows, with DB service cap 250.
- Apply only after verifying no relevant retention/legal hold and after monitoring output. Batch calls can be repeated for larger histories.
- Future/young reservations survive. Parent Outbox jobs and audit are NEVER deleted.
- No automatic cleanup scheduler is enabled; external LINE sends stay disabled. Revisit retention/DSAR policy before scheduling routine deletion.

Verification: unit tests check retention cutoff/validation; real PostgreSQL LINE smoke inserts an old reserved-at fixture and checks DRY_RUN, no cross-organization deletion, one bounded apply and preservation of newer rows.

Remaining P4-03e: provider uncertainty handling, in-flight consent revocation guarantees, external incident escalation, and privacy/retention sign-off. Keep LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false and LINE_OUTBOUND_MODE=disabled on DEV.
