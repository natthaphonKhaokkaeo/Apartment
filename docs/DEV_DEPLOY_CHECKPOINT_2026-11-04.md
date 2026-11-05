# Apartment DEV deployment checkpoint — 2026-11-04

## Completed
- Created and verified a protected PostgreSQL pre-deployment backup.
- Redeployed API, web, and LINE observer on the existing Dokploy Compose project, without touching unrelated applications.
- Current DEV database migrations increased from 17 to 18 after applying 0017; billing_batch_runs now exists.
- All Apartment containers healthy; internal web and health checks return 200.
- LINE Messaging API access token validated using provider bot-info endpoint (HTTP 200, no messages sent). Corrected configured bot user ID to match verified provider value in the root-only environment files and recreated the API/observer containers.
- Signed empty LINE webhook reached the API but returned 404 because organization and bot binding have not been configured; unsigned request returns 401.
- Added LINE channel-secret format validation with 2 RED/GREEN tests. Full tests 200/200 PASS, typecheck PASS, ESLint 0 errors and 5 warnings.
- Outbound LINE delivery remains disabled; observer-only worker remains active.

## Public ingress recovery verified later on 2026-11-04
- Recovered missing **Dokploy-managed Traefik** using the official Dokploy installation configuration, existing `/etc/dokploy/traefik` files and the existing `dokploy-network` (no extra proxy or changes to unrelated app containers). Traefik standalone container `dokploy-traefik` uses restart=always and exposes public 80/tcp, 443/tcp and 443/udp.
- The existing Let's Encrypt ACME store has a certificate for `apartme.makemarket.space`. After Traefik started, public HTTPS with normal certificate verification returned **200**, HTTP redirects to HTTPS with **301**, and `/healthz` and `/readyz` return **200**.
- Added `infra/smoke-apartment-public-dev.sh`: public HTTPS cert validation, web/API readiness and unsigned LINE webhook rejection all PASS; no real LINE provider sends performed.
- Do not confuse this with provider webhook verification or live LIFF browser E2E. Existing ACME email in config is a placeholder and must be reviewed before long-term renewal.

## Remaining blockers
1. Public HTTPS ingress is restored and public smoke passes. Verify Let's Encrypt renewal contact email and long-term cert rotation before Production; provider-side LINE webhook verification and browser E2E remain pending.
2. Zero organizations and zero LINE OA bindings exist in DEV. Create an organization through authenticated management flow and bind bot through PUT /v1/admin/line-oa/bindings. Verify real human LINE admin identity before giving access.
3. Complete public LIFF E2E, LINE webhook Verify, provider consent test, finance acceptance, offsite recovery, coverage >=80%, independent security review, legal approval, performance/UAT, and Figma acceptance before claiming Production readiness.
4. Concurrent uncommitted working-tree changes must be reviewed before commit/push. No blanket stage/commit was performed.

## Quick read-only checks
- docker ps --filter name=apartment-dokploy-dev-ajcnbm
- curl -i http://127.0.0.1:18089/healthz
- docker service ls
- ss -ltn
- curl -I https://apartme.makemarket.space/
