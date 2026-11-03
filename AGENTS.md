# Agent development instructions
- Read README.md and docs/implementation-status.md; preserve user work and uncommitted files.
- Scope every DB operation through authenticated organization membership. SUPER_ADMIN only via trusted LINE bootstrap config.
- Money integer satang, readings milli-units, calendar intervals [start,end).
- Invoice issue transaction + immutable snapshot + idempotency and audit; guard unverified tariffs.
- Never skip tests or bypass verification. Do not push/deploy/schedule external messages or take real payments without authorization.
- Do not put LINE credentials, cookies, or DB passwords in source control.
