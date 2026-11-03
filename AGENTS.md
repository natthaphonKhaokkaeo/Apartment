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
