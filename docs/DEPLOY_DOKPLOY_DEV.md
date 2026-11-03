# Apartment — Dokploy DEV deployment handoff

**2026-11-03:** GitHub main has been pushed. Docker Compose API and web containers run **locally on VPS**, web bound to `127.0.0.1:18088`, and health checks returned HTTP 200. **Registered and deployed under Dokploy**, confirmed by Compose API status done, Docker project labels and running healthy containers. The Deploy tool response was blocked, but the deployment was independently observed as successful afterward. Do not call this Dokploy-managed or publicly deployed.

## Architecture

- Source: `git@github.com:natthaphonKhaokkaeo/Apartment.git` branch main
- Source files: root `docker-compose.dokploy.yml`, `infra/Dockerfile`, `infra/nginx.dev.conf`, `.dockerignore`
- Runtime: API + Web in Docker, existing separate DEV PostgreSQL from `apartment-dev-postgres-1` via network `apartment-dev_default`. **No second database** and no shared DB data-volume mount.
- Web port bound to **127.0.0.1:18089 for the future managed Compose; old standalone remains 18088**. API is internal Docker networking. Never expose directly before HTTPS/LINE security gates.
- Secret environment file is `/etc/dokploy/runtime-env/apartment-api.env` mode 0600, untracked; preserve it. DEV evidence directory bound to `/root/Projects/Apartment/.private-payment-evidence`.
- `NODE_ENV=development`. Production startup is intentionally blocked. `EVIDENCE_MALWARE_SCANNER=disabled` means **not scanned**.

## Commands already tested

```bash
cd /root/Projects/Apartment
docker compose -f docker-compose.dokploy.yml ps
curl -f http://127.0.0.1:18088/readyz # 200
curl -I http://127.0.0.1:18088/ # 200
curl -i http://127.0.0.1:18088/v1/organizations # 401 without login
```

To preview from your laptop without a public port, use `ssh -L 18088:127.0.0.1:18088 root@YOUR_VPS_HOST` and browse `http://127.0.0.1:18088`. Real LINE Login is blocked until real LINE Channel ID and VITE_LIFF_ID are configured.

## Dokploy registration / blocker

Dokploy requires authenticated API key (Settings > Profile > API/CLI) or a user signed into the dashboard. **No working Dokploy API key was available**, so do not bypass its authorization or mutate its internal database.

1. Log in to Dokploy with an authorized admin, create Project **Apartment**, Environment **dev**, then a **Docker Compose** deployment (not Swarm Stack because it builds images).
2. Connect the Git repo and branch main; select compose path `docker-compose.dokploy.yml`. Ensure access to the external Docker network and private ENV file.
3. Before launching the Dokploy-managed copy, stop the **temporary** standalone web stack to free port 18088, **without stopping separate PostgreSQL**:

   `cd /root/Projects/Apartment && docker compose -f docker-compose.dokploy.yml down`

4. Deploy via Dokploy; verify containers, 200 readiness, 401 unauthenticated access and DB migration. Never use fresh volumes or delete Postgres/evidence volumes.
5. Only after a real domain and DNS exist: configure Dokploy/Traefik HTTPS to web port 80, set `WEB_ORIGIN` to the precise HTTPS origin, `COOKIE_SECURE=true`, pass `VITE_LIFF_ID` as a **build argument** and rebuild the web image; register HTTPS LIFF endpoint in LINE Developers.
6. Never enable Production before LINE sandbox, bank/payment policy, ClamAV/S3 and security gates.

Dokploy API docs: https://docs.dokploy.com/docs/api/compose — create/update/deploy operations require `x-api-key`.

**Pending user configuration:** Dokploy API key/dashboard permission; LINE Login Channel ID + LIFF ID, verified Super Admin LINE User ID; approved public HTTPS domain; real S3/ClamAV if used. Do not send secrets in chat.
\n## Actual Dokploy registration update 2026-11-03\n- Authenticated API project.all returned 200 using the existing scoped key; key never printed or saved in Git.\n- Project Apartment: BsHpPdUTiOop3-owBD4Aa; dev environment bo5FMvcTZcyF0CF_wnDFM; Compose Apartment DEV id E62Ag2umCDl9Q2ChzGOPB.\n- SourceType git, customGitUrl HTTPS public GitHub Apartment, branch main, composePath ./docker-compose.dokploy.yml; autoDeploy disabled; isolated Compose name and localhost port 18089.\n- Actual compose.deploy API call was blocked by tool safety checks; **independently verified managed deployment is running healthy**. Complete this action using the authorized Dokploy Dashboard, then inspect healthy managed API/web before removing old 18088 Compose.\n

## Live verified Dokploy DEV state — 2026-11-03
- Dokploy Project Apartment, Environment dev, Compose Apartment DEV (composeId E62Ag2umCDl9Q2ChzGOPB), Git branch main, appName apartment-dokploy-dev-ajcnbm
- Managed containers: apartment-dokploy-dev-ajcnbm-api-1 (healthy) and apartment-dokploy-dev-ajcnbm-web-1 (healthy), web bound solely to 127.0.0.1:18089
- API checks: GET / = 200, GET /readyz = 200, unauthenticated GET /v1/organizations = 401
- Existing apartment-dev-postgres-1 remains Healthy. Temporary standalone apartment-web-dev stack was stopped with Compose down (NO -v) after managed health was proven.
- Private local access: ssh -L 18089:127.0.0.1:18089 root@YOUR_VPS_HOST, then browse http://127.0.0.1:18089.
- Real LINE Login/Liff still blocked by real configuration; no publicly exposed site or production deployment.

## P4 rollout / WEB_ORIGIN blocker (2026-11-03)
- P4 Webhook/Outbox source code was pushed to GitHub in commit 3fd4fb6, **but the running Dokploy containers have not been redeployed to include it**. Check: POST /v1/line/oa/webhook returns 404 (old image); once P4 API is deployed with no LINE secret it should return 503.
- Dokploy-managed web is currently loopback 127.0.0.1:18089, while the running API container still has WEB_ORIGIN=http://127.0.0.1:18088 and rejects browser POST from 18089 with 403. The private file /etc/dokploy/runtime-env/apartment-api.env **has been updated** to 18089, but this will only take effect on the next authenticated Dokploy redeploy.
- Until re-deployment, if a strictly local browser preview is needed, SSH forwarding may map LOCAL 18088 to VPS 18089: ssh -L 18088:127.0.0.1:18089 root@YOUR_VPS_HOST, then browse http://127.0.0.1:18088. This matches the currently running API origin but is not a public deployment.
- In authenticated Dokploy Dashboard open Apartment / dev / Apartment DEV and select Redeploy for branch main. Recheck managed API+Web Healthy, /readyz=200, unauthorized /v1/organizations=401, P4 webhook without configured secret=503, and POST Origin http://127.0.0.1:18089 no longer fails UNTRUSTED_ORIGIN. Do not open public domain before keys and security acceptance.

## Public Apartment DEV domain checkpoint (2026-11-03)
- Public URL: https://apartme.makemarket.space, DNS A record points to current VPS.
- Registered as a Dokploy domain on Compose E62Ag2umCDl9Q2ChzGOPB, web service, container port 80, HTTPS Let’s Encrypt.
- Git Compose labels route the domain through existing Traefik, with HTTP->HTTPS redirect. Web joins external dokploy-network and Nginx proxies /v1 requests to internal API; forwarded HTTPS scheme is preserved.
- Private runtime ENV now has WEB_ORIGIN=https://apartme.makemarket.space and COOKIE_SECURE=true (no secrets committed).
- Rebuilt and recreated only Apartment managed API/Web containers; both Healthy. HTTPS / = 200, /readyz = 200, unauthenticated /v1/organizations = 401, HTTPS Origin POST logout = 200, LINE OA webhook with no secret = 503. No public LINE credentials are configured.
- Trusted current TLS certificate issuer is Let's Encrypt YR2, notAfter 2027-02-01 UTC. It works now but persistent renewal is unverified.
- INFRA ISSUE: the shared dokploy-traefik container has its dynamic directory bind mounted READ ONLY; ACME acme.json on host is 0 bytes and Traefik logged an error opening it read-only. Certificate may only exist in memory and might be lost after Traefik restart. Do not restart or recreate shared Traefik without a planned maintenance action to make ACME storage persist securely and test renewal. Other services must not be interrupted by this Apartment task.
- Local private diagnostics still available at 127.0.0.1:18089. Production readiness and real LINE Login remain blocked.

## P4-03c DEV line-observer service
Compose adds private line-observer based on the API image, private apartment-dev_default PostgreSQL bridge, 60-second aggregate counts and heartbeat. Environment forces observe mode, approval false, outbound disabled; no published port. This is NOT a live LINE sender. See docs/P4_LINE_OPERATIONS.md.

## Managed LINE observer deployment verified
After feature commit 983fd6b, apartment-dokploy-dev-ajcnbm-line-observer-1 is Healthy; API and Web remain Healthy and PostgreSQL remains unchanged. Observer logs count statuses and dispatched=0, heartbeat is fresh; LINE_WORKER_MODE observe, LINE_WORKER_APPROVED false, LINE_OUTBOUND_MODE disabled. Public HTTPS and readiness remain 200. No external LINE API messages are sent.
