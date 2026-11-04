# Phase completion audit — 2026-11-04 (DEV, not Production)

Source of truth for checklist states: `docs/PHASES.md`. A completed unit implementation is **not** the same as user acceptance, certified infrastructure, or legal/Production sign-off.

| Phase | Observed implementation | Open gates |
| --- | --- | --- |
| P0 Foundation | Monorepo, Fastify/React/PostgreSQL, migrations, DEV Compose, core auth and test suites | CI 2/2 remote green, lint and high/critical dependency audit now present; branch enforcement, API line coverage >=80%, remaining Moderate advisories and proven migration rollback pending |
| P1 Property/Billing | Room/lease/bill, rate history, meter replacement, staff scope, move-in/out and maintenance in DEV | Deposits/refunds/former-tenant record policy, owner/tenant browser UAT, legally verified meter/tariff evidence, duration/throughput acceptance |
| P2 Tenant/LIFF | Hashed invitation, tenant claim and owner approval, access-isolated tenant billing UI | Actual LINE Channel ID, LIFF ID, linked sandbox test users and real mobile/browser callback/login UAT |
| P3 Payment | PromptPay QR builder, manual owner ledger, bounded private/S3-mock evidence, informational PDF, two-owner adjustments | Real recipient confirmation in bank app; live S3/IAM/CORS; actual ClamAV; refund/settlement policy; receipt/VAT/tax/retention legal review |
| P4 LINE OA | Signed webhook, consent and outbox with disabled external sends; observer and quotas | Real provider/sandbox, quota calibration, consent/marketing/legal review, live sender and event notifications, paging policies |
| P5 Operations | Maintenance and room state DEV verified; Bulk Billing implementation in **another session's uncommitted working tree** | Integration/migration 0017 pending, attachments/anomalies, deposit, occupancy/export, contract/tenant profile, privacy and SLA workflows |
| P6 Figma | Not started | User must choose authorized workspace/team before creating editable assets; visual design QA pending |
| P7 Production QA | Partially implemented GitHub Actions workflow and independent DEV security checks | Remote CI confirmed green, lint/coverage/Playwright, penetration/IDOR/CSRF/SSRF review, offsite restore, regulatory/financial sign-off and UAT |

## Operationally safe next steps

1. Complete CI remote execution evidence, add lint/coverage and owner/tenant browser E2E with synthetic test identities. Keep production features locked.
2. Continue P1-05 bounded security tests and profile, and independently implement non-conflicting DEV work.
3. Coordinate migration 0017 with the session owning P5 Bulk Billing. Do **not** stage their uncommitted changes, apply that migration prematurely, or deploy a partial schema/API combination.
4. Define policy for deposits, refunds, tax receipts, former-tenant access and data deletion with the product/legal owner before enabling financial side effects.
5. Configure external LINE/LIFF, cloud object storage and bank-app QA through approved secrets management, then conduct actual-provider tests. Never put credentials in code, docs or chat.
6. Public HTTPS is currently DOWN after reboot (TCP 443 unavailable; shared Traefik container absent). Confirm durable Traefik ACME certificate storage and offsite backups via separately authorized infrastructure maintenance without restarting shared services in an Apartment feature session.

The missing items above are **not** considered DONE until there is fresh code, repeatable automated test evidence and required human/provider acceptance where applicable. No live LINE sending, real bank settlement or production cutover is authorized from this audit.
