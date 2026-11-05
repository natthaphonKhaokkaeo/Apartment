# P5-PRIVACY-01 — Profile request and guarded anonymization

Scope: account profile and LINE account linking only. This is not full data erasure or a legal compliance certification. Immutable invoices, financial ledger, payment evidence, audit history and backup archives are retained under their separate approved policies.

## Task and acceptance

| Task | Phase | Status | Files | Evidence | External dependency | Commit / deployment |
|---|---|---|---|---|---|---|
| P5-PRIVACY-01 request/review | P5/P6 | IN_PROGRESS | privacy-requests service/routes, PrivacyCenter, schema + migration 0020 | Focused isolated PostgreSQL smoke PASS; policy 12 tests PASS; full gates running | None for request/review | Uncommitted; not deployed |
| P5-PRIVACY-02 guarded profile execution | P5/P7 | IN_PROGRESS | privacy-policy + privacy-requests | Disposable synthetic execution PASS, including concurrent replay and unchanged invoice | Approved policy and retention period required before enabling real execution | DEV default disabled |
| P5-PRIVACY-03 complete retention/erasure policy | P5 | BLOCKED | This runbook; .env.example | Financial/evidence/backup retention explicitly excluded from profile workflow | Operator/legal policy approval, evidence retention and recovery-key custody | Not claimed complete |

## User and administrator flow

An authenticated user submits a reason and an explicit acknowledgement that the request covers only the profile. Idempotency is scoped to the authenticated user; one open request is allowed at a time. The user can list or cancel their own open request. A foreign request ID returns 404. Users cannot choose the subject or override a policy through the request body.

Only an active platform administrator may review requests. Approval records a decision; it does not execute anonymization. A separate preview reports eligibility. Execution requires an approved request, explicit profile-only acknowledgement and a server configuration gate. Current status and eligibility are checked again under database locks when execution occurs. Execution revokes sessions, disables membership/grants, unlinks ended leases, pseudonymizes LINE delivery references and clears the user profile. It does not send LINE messages or transfer money.

Protected/bootstrap administrator accounts cannot submit this request. Active OWNER memberships require handoff first. Any linked lease not ENDED, pending submitted payment claim, or unelapsed approved retention period blocks execution. Financial snapshots and financial amounts remain unchanged. Execution retries return the existing result and do not create a second execution audit entry.

## Runtime policy gate

Default and deployed-safe setting:

```
PRIVACY_PROFILE_ANONYMIZATION_APPROVED=false
PRIVACY_PROFILE_RETENTION_DAYS=
PRIVACY_POLICY_EVIDENCE_REF=
```

Do not infer a legal retention period from examples or tests. When an operator has approved actual policy, the days must be an integer from 1 to 36500 and evidence reference must be 12–200 characters. Startup rejects approved=true without both values. Runtime secrets/configuration stay outside the repository. Synthetic tests explicitly use TEST_ONLY_NOT_LEGAL_APPROVAL in an isolated database; this is not a real approval.

## Verification

`APARTMENT_FOCUSED_SMOKE=smoke-privacy bash infra/test-api-postgres-coverage.sh` creates a disposable loopback PostgreSQL container and refuses a non-test database URL. It verifies the default-disabled gate, unprivileged administrator denial, cross-user isolation, idempotency, cancellation, owner/lease/payment/retention blockers, concurrent exactly-once execution, session revocation and unchanged immutable invoice. Browser tests submit and cancel via the actual API at desktop/390/320 without API interception.

Full validation: `bash infra/verify-apartment-dev.sh`. Never execute tests against the live DEV database and never use a real account to rehearse anonymization.

## Residual boundaries

This feature does not delete financial snapshots, uploaded evidence, backups, audit metadata or third-party provider data. Administrators must avoid unnecessary personal information in review reasons. Restoration can reintroduce retained profile data from older archives; an approved recovery procedure must reapply the relevant privacy actions before exposing restored data. Whole-system retention, evidence legal holds, subject access escalation and operator/legal signoff remain separate acceptance tasks. No automatic deletion schedule is installed by this feature.

## P2-PRIVACY-RACE-01 security regression

A separate disposable regression held the claimant's user row locked while approving an already claimed invitation. RED reproduced an approval that completed with a stale active identity before the account disable committed (`apartment-qa-privacy-race-red2`, assertion: approval must wait for locked target profile). GREEN now locks the claimant before the lease and invitation, matching profile execution, then rechecks invitation ownership under its write lock. The approval waits, observes the disabled user, returns TENANT_ACCOUNT_DISABLED and leaves both the lease and invitation unlinked (`apartment-qa-privacy-race-green`). Approval also requires an active OWNER, active account and active organization inside the transaction; MANAGER and platform-admin without OWNER membership cannot bypass it. Unit fixtures now model the owner and claimant separately and include revoked owner/account/organization denial without writes.

Replay: `APARTMENT_FOCUSED_SMOKE=smoke-privacy-link-race bash infra/test-api-postgres-coverage.sh`. No actual account or provider identity is involved.
