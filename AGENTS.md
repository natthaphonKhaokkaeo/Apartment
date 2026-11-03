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
