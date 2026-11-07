# Billing Preview, SUPER_ADMIN permissions, and initial meter baseline — 2026-11-07

## Reported defects and root causes

1. Single-room billing previously rendered preview results as a transient global notification. There was no durable itemized preview, and the Confirm button did not require preview. The asynchronous rooms list could also arrive after the form mounted, leaving the room selection empty and the Calculate button disabled.
2. Some billing functions used an OWNER-only membership guard even after SUPER_ADMIN had passed verified session and active organization checks; the platform administrator therefore received `OWNER_REQUIRED` on correction/reissue and batch billing.
3. Meter reading `NON_MONOTONIC_READING` was reported in the same workflow as billing. The guard correctly rejects decreasing historical values; however, invoice calculation previously required an explicit boundary reading even when no earlier reading had ever been recorded. First-cycle billing can now adopt a virtual zero **only** at the start of a meter's history.

## Changes

- `SingleRoomBillingCenter` is a real controlled billing form. It waits for rooms to load and automatically selects a valid occupied room, shows local errors and a durable itemized preview with rent, water, electricity, rates, quantities, optional notes and total, and disables confirmation until the preview is current. A change to the room, dates, partial mode or note invalidates the preview. Confirm uses an idempotency key; retries retain the key if the network fails. Successful issuance refreshes the invoice list. No financial data is written by Preview.
- The existing bulk billing preview now displays each charge as a distinct line inside each property's room row, shows READY vs SKIPPED and reasons, and invalidates the active preview when the period/note changes. Bulk transaction approval, preview hash, stale detection and idempotency are unchanged.
- A verified active SUPER_ADMIN may execute owner-level operations after verifying property and active organization; billing batch and reissue still serialize writes, verify invoice preconditions, and preserve audit records with actor ID, organization, event, target and amount. Add actor platform role / property ID to key invoice and batch audit metadata. OWNER permissions remain mandatory for regular users; managers/staff do not gain owner privileges.
- Matching administrator capability is enabled for property and room rates, property team management, meter review/replacement, tenant invitation approval, move-out and deposit actions, subject to the existing transaction locks and service scope. **Independent second-owner financial adjustment approvals are intentionally not bypassed**: this separation-of-duties requirement remains in place until a distinct controlled process is defined.
- Invoice computation assumes a zero opening meter value only if there is no earlier reading and no replacement up to the start date. This virtual baseline is represented in the immutable invoice line snapshot via `startAssumedZero`, never written as a fake reading row. A valid end-of-period meter reading is still required. Existing readings, decreasing measurements, historical periods and meter replacement boundaries retain their normal validation; there is no silent reset to zero for a running meter.
- The UI explains `NON_MONOTONIC_READING`, `DUPLICATE_READING` and missing meter boundary records in Thai rather than showing opaque error codes.

## Verification checklist

- Unit: `apps/api/tests/billing-owner-authorization.test.ts`, `billing-owner-superadmin.test.ts`, `meter-initial-baseline.test.ts` and existing meter/reissue/billing suites.
- Browser UI: after web build, `corepack pnpm --filter @apartment/web smoke:billing-ui`. Playwright mocks **all** `/v1/` API calls; it verifies SUPER_ADMIN rendering, asynchronous room load, preview/confirm, stale edits and bulk itemized preview without changing actual bills or tenant data.
- Full: `corepack pnpm test`, `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm --filter @apartment/web build`.
- Deployment: Docker Compose/Dokploy DEV API+Web, then health and anonymous authorization checks. Manual authenticated owner/tenant meter UAT remains recommended to confirm domain-specific lease/reading dates, because no real customer invoice will be created as an automated test.

## Business safeguard

Do not bypass valid descending-reading protection. If a physical meter was swapped or its counter rolled over, record the actual meter replacement with opening/closing values, not a fabricated zero in a later period. `METER_BOUNDARY_READING_REQUIRED` remains appropriate when the end reading or a later cycle's start reading is absent. LINE tenant notifications continue to depend on verified recipient binding and opt-in consent.
