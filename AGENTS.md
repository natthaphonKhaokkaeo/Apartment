# Agent development instructions
- Read README.md and **docs/PHASES.md** (canonical handoff) and docs/implementation-status.md; preserve user work and uncommitted files.
- Scope every DB operation through authenticated organization membership. SUPER_ADMIN only via trusted LINE bootstrap config.
- Money integer satang, readings milli-units, calendar intervals [start,end).
- Invoice issue transaction + immutable snapshot + idempotency and audit; guard unverified tariffs.
- Never skip tests or bypass verification. Do not push/deploy/schedule external messages or take real payments without authorization.
- Do not put LINE credentials, cookies, or DB passwords in source control.

- P3 payment amounts must remain integer satang. Manual Ledger approvals are NOT independently bank-verified funds.
- Evidence is private: re-encode images, limit size, authorize reads, do not expose static files.
- Consult docs/ENV_REQUIRED.md for missing keys; never log banking data, access tokens or uploaded files.

- S3 signed tickets: never trust client content type/hash without bounded HEAD/GET, exact size/checksum verification and pixel-only WebP re-encoding. Never issue public GET links.
- P3 S3 mock test is not real provider IAM/SigV4/CORS evidence. Keep production startup fail-closed until completed security gate.
- Next phase P3-05 may create Billing Notice PDF only, explicitly NOT a receipt or tax invoice until legal requirements and issuer data approved.

- P3-05b informational PDF must never be represented as tax invoice or official payment receipt. Validate stored immutable invoice line total; new invoice gets issuance-time metadata snapshot, old invoice gets explicit legacy current-record warning.

- Orphan cleanup is manual DRY_RUN by default and must not delete legal-hold/CLAIMED/Payment Claim-linked evidence. Production policy, lifecycle, provider tests and backups are incomplete.
- ClamAV disabled in DEV means NOT SCANNED. Enabled scanner is fail-closed; never expose clamd TCP publicly.

- User authorized GitHub push and DEV deployment on 2026-11-03; never open a public service or claim production readiness without LINE/S3/security gates. Dokploy registration still requires authorized API key.
- Finance adjustments require two distinct active OWNER accounts, immutable original ledger, and no cash transfer for refund/dispute review. See docs/P3_FINANCIAL_ADJUSTMENTS.md.
\n- LINE OA webhook: preserve raw body until constant-time HMAC verification, reject invalid signature and wrong destination. No automatic reply from webhook. Never log webhook message text or tokens.\n- LINE Outbox: require live consent bound to active lease/org and OA; stable LINE X-Line-Retry-Key within 24h, no provider calls by default. SIMULATED never means sent.\n- Dokploy registered Apartment/dev/Compose using existing scoped key; deployment blocked by tool safety checks. Old temporary loopback Docker stack continues until managed copy verified.\n
- Public DEV domain apartme.makemarket.space routes through existing Traefik and Nginx. Do not restart shared Traefik in Apartment maintenance: its ACME storage is currently mounted read-only and renewal persistence must be fixed safely first.

- P4-04 explicit LINE tenant notification consent is scoped to active verified lease + server session LINE subject. Never use user-provided recipient/org, never send if revoked, and do not auto-enable consent. Invoice BILL_ISSUED and due-date reminders are queued transactionally only after exact active consent; no live LINE sender/scheduler until real sandbox/security acceptance.

- P4-03c DEV line-observer is ALWAYS observe-only in Compose (LINE_WORKER_MODE observe, approval false, outbound disabled). Never activate a live worker without sandbox, consent, quotas, monitoring and operational signoff. Admin operations cannot reveal LINE IDs, message bodies or retry keys, and terminal reviews must never resend.

- P4-03d live send quotas: all reservations must be serialized through the transaction-level PostgreSQL advisory lock (global 72853019947) and counted even for failed provider sends, with least-used-org fairness. DEV must remain observe-only / outbound disabled. Incidents are internal DB/UI alerts only (not external paging); never auto-requeue acknowledged/DEAD jobs or expose recipient PII.

- Apartment PostgreSQL backups are root-only via infra/backup-apartment-postgres.sh and systemd daily 03:30 Asia/Bangkok, retention 14 days, local only. Never modify/delete persistent apartment-dev_apartment_pg_data volume, never restore over the live database. Offsite copy is still pending. Runbook: docs/POSTGRES_BACKUP_RESTORE.md.
- P4-03e: consent revocation and LIVE dispatch use matching lease->OA->consent read locks vs lease/consent write locks; do not remove this serialization without security re-review. Existing provider sends cannot be recalled. Reservation cleanup requires explicit org scope, minimum 30d, dry-run default and explicit apply confirmation.

- P1-01a move-out requires an active OWNER membership (no MANAGER/SUPER_ADMIN shortcut), property→lease→room transaction locks, exclusive end boundary with both final utility readings, final issued settled invoice, no pending payment/finance. Never write off balances automatically; retain immutable finance history. Revoke lease invitations, LINE consents and pending Outbox after termination. Repair/deposit and partial-period support remain separate phases.

- P1-02 price history: append new property_rate_versions only via API. OWNER
  alone schedules complete rates at full period boundaries, after legal utility
  review and without changing already-issued invoices. Property locking is
  shared with billing. Preserve masterRateVersionId in each invoice line
  snapshot. Never backdate or rewrite historical rates. See
  docs/P1_PROPERTY_RATE_HISTORY.md; P1-03 room override dates remain open.

- P1-03a: room_rate_versions appended for new override schedules; do not PATCH
  room rate fields directly. Schedule full nullable values at canonical billing
  starts, owner-only, audit, legal utility ceiling. Billing snapshots both
  masterRateVersionId and roomRateVersionId and never rewrites issued invoices.
- P1-03b MOVE_IN partial: allow ONLY real lease.startDate through canonical
  billing interval end, actual water/electric meter boundary readings, prorated
  rent, property lock and no overlapping ISSUED lease intervals. Arbitrary
  manual partial periods, MOVE_OUT and meter replacement are not implemented.

- P1-03c: any meter swap needs owner authorization, property→room lock,
  immutable event with old closing/new opening values and serial continuity.
  Insert the opening reading on replacement day; ordinary reading monotonicity
  applies only within physical meter segments. Billing sums swaps in
  (periodStart,periodEnd] and snapshots replacement IDs; never rewrite past bills.
  MOVE_OUT partial is an exact final slice inside a canonical period, no future
  handover, no overlapping ISSUED intervals. Closing the lease separately needs
  every final invoice settled and physical handover; never auto-refund deposits.
  EvidenceRef is not verified file evidence. See docs/P1_METER_REPLACEMENT_MOVE_OUT.md.
