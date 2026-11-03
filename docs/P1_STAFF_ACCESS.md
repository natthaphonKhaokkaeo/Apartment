# P1-04 — Property staff authorization and member invitations (DEV)

## Scope

- Organization OWNER (an **active verified organization membership**, not platform SUPER_ADMIN or MANAGER alone) can create, inspect, approve or revoke staff invitations and active staff access.
- A staff invitation is one-time, 256-bit CSPRNG token, stored only as domain-separated SHA-256 hash. **24-hour expiry**. Token returned only on creation; owner must distribute via a trusted, private channel. No automatic LINE messages.
- Claim requires authenticated **active account**. Claim only records pending identity; no membership or grants become active until OWNER manually confirms recipient and approves.
- MANAGER invitation grants organization-wide existing operational permissions. MANAGER cannot manage invites or membership, and cannot revoke OWNER. New STAFF only gains an explicitly assigned property-level grant.
- STAFF VIEWER: property list (safe metadata only), room list (safe metadata only), meter readings read. No lease/tenant, invoice/payment, billing, tariff, property modification or room modification APIs.
- STAFF METER_READER: VIEWER rights plus meter reading POST. Other writes denied.
- STAFF membership alone grants **zero** property access without matching active property grant and active organization. No platform SUPER_ADMIN bypass for managing personnel.
- A staff member can hold multiple independent property grants (only active grants are effective); revoking the last active grant disables the STAFF membership. An org-wide MANAGER is revoked by disabling its membership. Membership and grant reads occur on each API request, not by trusting client-provided role.
- Meter reading writes acquire org SHARE lock and recheck the active membership and METER_READER grant **inside the write transaction**. Owner revoke obtains org UPDATE lock; existing in-flight writes complete before revocation becomes effective. No stale permissions after completed revoke.
- Audit actions: STAFF_INVITE_CREATED, STAFF_INVITE_APPROVED, STAFF_INVITE_REVOKED, STAFF_ACCESS_REVOKED. Audit does not store invitation token. Owner view lists only claimants' display names and IDs, never hash, LINE subject or raw credential.

## API (requires session cookie)

| Method | Path | Authorization |
| --- | --- | --- |
| GET | /v1/organizations/:orgId/staff/members | OWNER |
| GET | /v1/organizations/:orgId/staff/invitations | OWNER |
| POST | /v1/organizations/:orgId/staff/invitations | OWNER |
| POST | /v1/staff/invitations/claim | Authenticated recipient |
| POST | /v1/organizations/:orgId/staff/invitations/:inviteId/approve | OWNER |
| POST | /v1/organizations/:orgId/staff/invitations/:inviteId/revoke | OWNER |
| POST | /v1/organizations/:orgId/staff/members/:userId/revoke | OWNER |

Invite creation examples:

- `{"role":"STAFF","propertyId":"<uuid>","level":"VIEWER"}`
- `{"role":"STAFF","propertyId":"<uuid>","level":"METER_READER"}`
- `{"role":"MANAGER","propertyId":null,"level":null}`

Claim: `{"token":"<one-time-token>"}`. Revoke STAFF grant: `{"propertyId":"<assigned-property-uuid>"}`; revoke MANAGER: `{"propertyId":null}`.

API credential protection uses HttpOnly authenticated session, Origin checks for writes, scoped rate limits and no-store responses. OWNER checks server-side membership every time; revocation is transactional. The client never supplies the target user's authorization role in approve/revoke.

## Migration

- `0015_bright_loki.sql`: extends membership_role with STAFF; creates property_staff_level enum, property_staff_grants, staff_invitations; unique scope indexes, FKs.
- Applies to dedicated Apartment DEV database only. An explicit database backup with SHA-256 verification was made before applying; never apply blindly to Production/shared databases.
- Migration **does not change** existing OWNER/MANAGER memberships, invoices, finances, tenant records, LINE consents or PostgreSQL Docker volumes.

## Acceptance / verification

- `corepack pnpm --filter @apartment/api test`
- `corepack pnpm --filter @apartment/api typecheck`
- `corepack pnpm --filter @apartment/api smoke:staff`
- `corepack pnpm --filter @apartment/web build`
- Existing HTTP, finance, payments, S3 mock, evidence cleanup and LINE observer/consent smoke suites must remain green.
- Real LINE Login/LIFF, multi-browser UI E2E, independent security QA, long-running concurrent load tests and legal operational acceptance still belong to later phases; DEV code is not production-ready.
