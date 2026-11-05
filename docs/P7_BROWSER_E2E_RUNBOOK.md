# P7 — Browser E2E Runbook (DEV)

## Scope and safety

This suite exercises the built Vite/React frontend in Playwright Chromium.
All `/v1/*` API calls are intercepted by in-browser test fixtures. No real
LINE Login provider, banking endpoint, DEV database mutation or external message
delivery is involved. Unknown API paths fail closed with mocked HTTP 403.
Tests are useful *frontend contract* evidence, not server authorization proof.

## Run locally or on VPS

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

`test:e2e` builds `@apartment/web` then starts local Vite preview on
`127.0.0.1:4173`. Tests close the preview server afterward. Browser artifacts
in `test-results/` and `playwright-report/` are gitignored.

## Scenarios

Each of the nine tests runs in desktop Chromium and 390px / 320px mobile Chromium:
- Guest sees LINE entry point; owner/tenant screens remain hidden.
- Authenticated owner sees organization-scoped overview, may log out and is returned to the guest screen.
- STAFF has rooms/meter entry only, no billing/payment/settings/admin navigation; owner financial APIs are not loaded.
- Tenant without organization sees only self-service, no owner invoice list; checks no horizontal overflow.
- Tenant may open a mocked server-authorized invoice detail and close it.
- A mocked HTTP 404 on a foreign invoice must not show detail content.
- Owner creates a one-time invitation code after an explicit confirmation, not before.
- Tenant claims a code through a POST (never URL parameters), and stays pending owner approval without billing data.
- Owner explicitly confirms approval of the claimed invite; the UI then shows the approved state.

**Latest independent execution: 27/27 PASS** on 2026-11-05.
The tests also exposed an inaccessible sidebar Logout button at shorter
viewports, fixed by giving the sticky sidebar bounded vertical scrolling.
The guest/tenant responsive tests explicitly check page horizontal overflow.

## CI

`.github/workflows/ci.yml` quality job installs Playwright Chromium with
OS prerequisites (`playwright install --with-deps chromium`) and invokes
`playwright test` after a Vite build with `VITE_LIFF_ID=''`.
No user credentials are provided to this job.

## Open acceptance gates

Real LINE sandbox login, callback, account linking, owner approval and logout
on actual LINE in-app browser / Mobile Safari / Chrome are **not verified**.
Complete those with operator-approved channel configuration and real consented
test accounts. An HTTP mock 404 does not substitute for independent server
IDOR tests against the disposable PostgreSQL CI database; both gates must pass.

Do not mark P2, P6 or P7 complete until the human/provider tests, performance,
accessibility and final security signoffs are separately recorded.

## Current real backend browser suite (2026-11-05)

Run `corepack pnpm test:e2e:postgres`. This creates and migrates a disposable PostgreSQL container, then executes `playwright.postgres.config.ts` with real API and Vite servers. Test sessions are seeded only in that disposable DB; no LINE token verification bypass exists in application code. Four scenarios per desktop/390px/320px passed (12/12): owner org/property/room/lease creation, expired session denial, logout revocation, STAFF read-only navigation and backend 403 financial denial. Tests never intercept `/v1/*`. Each viewport receives a fresh API process to isolate the normal rate-limit budget; CSRF and rate limits stay enabled. API and browser WEB_ORIGIN match port 4174. Current separate mock suite: 33/33 PASS. Remaining actual LINE callback, billing/payment evidence/maintenance browser workflows and operator UAT are not claimed complete.
