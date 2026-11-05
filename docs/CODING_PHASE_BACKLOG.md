# Apartment — Coding-first phase gap register (2026-11-04)

This register is a coding backlog, not a declaration of production readiness. Source of truth for acceptance remains docs/PHASES.md. Work order is P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7, but tasks that require external LINE identifiers are deferred **without blocking unrelated coding**. Keep all uncommitted changes and coordinate with the separate Bulk Billing session.

| Phase | Code that exists | Code still needed / independently verifiable gates | External or human acceptance (do not invent) |
| --- | --- | --- | --- |
| P0 Foundation | Monorepo, CI quality and PostgreSQL smoke, local backup/restore, disposable migration recovery, encrypted offsite upload and retrieve scripts | Increase API line coverage from 39.68% to at least 80% using meaningful HTTP/integration tests; enforce required CI rules after permissions available; finish the offsite pipeline's real remote-restore check and alerting integration | Offsite age/rclone binary installation, dedicated rclone remote, actual remote restore and RPO/RTO acceptance, GitHub admin permissions |
| P1 Property/Billing | Multi-tenant room/lease/owner routes, billing, effective-dated rates, move-out guards, maintenance, staff scope; deposit settlement preview policy (7 tests); former-tenant historical invoice read-only API + UI (7 policy + 6 HTTP tests) | Persisted deposit ledger/refund review API/UI after coordinated migration 0017, mid-cycle transitions, owner/tenant browser E2E and sustained load/security QA; end-to-end historical access proof | Business approval for deposit handling, tariff/legal notices, landlord/tenant UAT |
| P2 Tenant/LIFF | Invite hashing, claim/owner approval, tenant-scoped reads and UI | Complete automated browser callback/login/logout/claim E2E with mocked LINE adapter and test identities; verify E2E owner approval denial | Actual LINE Channel and LIFF IDs, HTTPS origin and linked sandbox test user are operator-supplied **later** |
| P3 Payment | PromptPay EMV QR builder and UI/API, manual approval, local private evidence, S3 adapter with mock tests, ledger/finance rules, informational PDF | Finish finance and receivables reporting, attachments/SLA as applicable, export/data retention and provider-independent E2E; validate real S3 against separately approved test environment | Actual bank-app recipient/QR verification, S3/IAM/CORS keys, malware scanner integration, tax/legal receipt specification |
| P4 LINE OA | Webhook signature validation, opt-in/consent/outbox, bounded worker and fairness, dry-run reminders | Complete remaining event producers, worker deployment/scheduler and mock-provider contract tests, correct opt-in revocation race gates | LINE API credentials/quotas and real provider E2E **later** |
| P5 Operations | Maintenance/room workflow; concurrently edited Bulk Billing and migration 0017 | Finish meter photo evidence and persisted anomaly reviews, deposit/dispute/credit notes, revenue reports, contract lifecycle and privacy deletion/retention; occupancy reporting and subject-scoped tenant JSON export are implemented in DEV with tests; integrate Bulk Billing only after other session completion and independent migration tests | SLA and financial product policy, performance and operator UAT |
| P6 UX & Figma | Responsive owner and tenant UI partially implemented | Code-level responsive/accessibility and empty/loading/error state checks; deliver editable design assets after authorized Figma workspace is selected | Figma file/team authorization and visual signoff |
| P7 Security/QA | CI, isolated database smoke tests, unit tests and selected security/load checks | Install an operable browser/test runner and implement Playwright browser E2E plus broader API coverage (snap Chromium currently fails sandbox/profile setup on VPS), independent security review, offsite operational monitoring, deployment/cutover runbook | User acceptance, legal and security signoff, public HTTPS/proxy and service-provider approval |

## 2026-11-04 subsequent coded features and remaining integrations

- P1: preview-only deposit money policy with no autonomous refund (7 tests); scoped former-tenant historical invoice API and TenantPortal read-only UI (13 policy/HTTP tests). Deposit database ledger, review/write API and legal signoff still required. Migrating after concurrently owned 0017 must be coordinated.
- P2: 8 mock-identity Fastify HTTP tests validate invite Claim and explicit Owner approval under expiry/replay/disabled state/CAS races. Real LINE setup/E2E remains deferred.
- P3: implemented scoped `/v1/properties/:propertyId/receivables.csv` (owner/admin only; repeatable-read, 500-record limit, immutable safe money/UUID/date serialization). 10 focused tests pass. Real bank verification/tax/refund workflow still outstanding.
- P5: implemented read-only room meter anomaly preview API plus policy, scoped to verified property and room, flags reset/replacement/spike/duplicate and never auto-adjusts invoice. 12 focused tests pass. Persisted review/evidence/configuration still missing.
- P6: keyboard focus visibility and reduced motion CSS implemented and build verified; independent WCAG and Figma acceptance remain open.
- 2026-11-04 further additions: owner-scoped mid-cycle billing segment preview (11 domain/HTTP tests); verified-user own-lease/invoice JSON export with Tenant Portal download (7 HTTP tests); property-scoped occupancy room/active lease reconciliation report (10 domain/HTTP tests), none modify shared DEV data. Persisted deposit/refund transactions, privacy deletion and provider/browser acceptance still need implementation.
- Current API V8 lines: 39.86% (2133/5351). Temporary CI no-regression floor 39%, not the required 80%. P0–P7 remain partial.

## Completed in the current coding pass

- P0: age ciphertext-only immutable offsite shipper, remote ciphertext SHA-256 readback, secure offsite retrieve-to-archive workflow. Neither script modifies live PostgreSQL.
- P0: eight fail-closed/checksum-only local preflight checks pass; fake age/rclone upload pipeline additionally checks immutable collisions, ciphertext readback corruption, simulated encryption failures and upload failures without any network. Shell syntax validation included in GitHub Actions quality job. Optional restricted systemd uploader service/timer (04:30 Bangkok) is checked in but has not been installed or enabled.
- P0: docs/OFFSITE_BACKUP.md contains the exact operator configuration and recovery preconditions.
- P2/P4 LINE secrets are explicitly deferred per user request; coding may continue against mocked providers. No real LINE delivery occurs.

## No-skips execution rules

1. Never mark a phase complete while any mandatory acceptance criterion is open. A code-complete subtask is distinct from a provider-verified or production-accepted phase.
2. For each code task, add an automated regression and run unit, typecheck, lint and applicable isolated PostgreSQL/HTTP checks. Record actual measurements, not estimates.
3. Do not modify another session's uncommitted Bulk Billing or database migration 0017, delete/stash user changes, commit a mixed tree, apply migrations to shared DEV or deploy without safety coordination.
4. Exclude external LINE ENV setup only; do not silently treat bank, S3, legal, financial or Figma acceptance as completed.
