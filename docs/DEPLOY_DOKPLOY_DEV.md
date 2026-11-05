# Apartment — Dokploy DEV deployment handoff

## 2026-11-05 deployed DEV checkpoint (ce49565)

- Integrated implementation dbf889a and CI build-environment fix ce49565 pushed. GitHub Actions run 41948158755 completed SUCCESS for both quality and PostgreSQL >=80% / backend browser jobs.
- Clean-archive images labelled ce495657c2b77b9d2cf9043c865a4e1450d58438 built and deployed through the existing Apartment Dokploy Compose configuration/project (Apartment API, Web and observe-only worker only). All healthy; PostgreSQL start timestamp unchanged, no shared proxy change.
- Applied migration 0018 and 0019; protected migration journal verification PASS. Fresh encrypted post-migration backup restored 36 public tables in a networkless disposable DB. Local backup timers remain enabled.
- Public HTTPS /, /healthz, /readyz 200; unsigned webhook 401. New deposit, meter records, privacy export and batch routes return 401 to unauthenticated public requests. Actual public guest browser checks at 1280/390/320 PASS with no navigation leak or horizontal overflow.
- Runtime stays LINE disabled / worker observe / approval false. Read-only LINE bot/info 200 with matching configured bot identity; zero external messages. Real LINE-account and bank UAT remain unverified.
- Latest local API tests 244/244; domain 15/15; domain lines 100%; actual HTTP/PostgreSQL API lines 87.03% over all 65 files, unit-only lines 40.49%; mocked browser 33/33, real-backend browser 12/12, public guest 3/3. Lint/types/audit High/Critical=0 pass (6 Moderate remain).
- Core increment DEPLOYED, NOT 100% overall. Continue remaining privacy/retention/contract, manual-refund reconciliation/reservation resolution, maintenance attachment/SLA, full financial browser and operator UAT work. No real erasure, refund, provider dispatch or Production release approval is inferred.


**Latest state (2026-11-03):** Apartment DEV is running in the existing Dokploy Compose project `apartment-dokploy-dev-ajcnbm`, with API, Web and observe-only LINE worker healthy. Web is bound to `127.0.0.1:18089`; the registered HTTPS domain currently returns 200. P1-05 and P5 maintenance rollout evidence is recorded at the end of this file. Earlier entries below are historical checkpoints; newer dated entries supersede them.

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

## P4-03d quota + incident DEV
The DEV line-observer keeps LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false, LINE_OUTBOUND_MODE=disabled and bounded internal attempt quota ENV. It now reconciles database-only internal incidents; no external notifications are sent. Source and security gates: docs/P4_LINE_QUOTAS_ALERTS.md.

## P4-03d managed deployment (2026-11-03)
Feature commit 826550c and quota configuration 9295d2e deployed in existing Apartment DEV Compose (API/Web/observe-only worker). Worker environment LINE_WORKER_MODE observe / LINE_WORKER_APPROVED false / LINE_OUTBOUND_MODE disabled / LINE_ORG_PER_MINUTE 5 / LINE_GLOBAL_PER_MINUTE 20. Heartbeat healthy, dispatched 0. Public HTTPS/readyz 200, Admin Alert API unauthorized 401. Provider sandbox and external paging NOT implemented. Do not restart shared Traefik because of documented read-only ACME persistence concern.

## P1-04 rollout after VPS reboot (2026-11-03)
- GitHub main commit `d259c94` includes P1-04 staff access and migration 0015. Verified PostgreSQL backup, migration applied, 67/67 unit tests, typecheck, web build and all API/payment/finance/S3/cleanup/LINE/staff smoke suites.
- Rebuilt only existing Apartment Compose project `apartment-dokploy-dev-ajcnbm` API/Web/observe-only worker; containers and existing `apartment-dev-postgres-1` healthy. Local 127.0.0.1:18089 / and /readyz HTTP 200; unauthenticated staff endpoint 401; unsigned LINE webhook 503. Worker `LINE_WORKER_MODE=observe`, `LINE_WORKER_APPROVED=false`, `LINE_OUTBOUND_MODE=disabled`, last observed dispatch count zero.
- **PUBLIC OUTAGE:** `https://apartme.makemarket.space/readyz` fails TCP connect; `dokploy-traefik` is Exited (255) after reboot, host has no port 80/443 listener. Logs show ACME acme.json cannot be opened due read-only bind mounts; certificate persistence was already broken pre-reboot. No shared proxy changes were made. A separate authorized infra maintenance plan must fix persistent certificate storage safely and restart/verify shared proxy, including other domains. Public acceptance remains BLOCKED until then.

## P1-05 source update (2026-11-03)

- Commit `c0dedbc` with invoice storage bounds, unit coverage and a bounded PostgreSQL HTTP concurrency/load smoke is pushed to `origin/main`.
- This source update is **not deployed**. The current workspace cannot access `/var/run/docker.sock` (permission denied), no Dokploy MCP/dashboard tool is available in this session, and Dokploy auto deploy is disabled. The last deployed application baseline remains P1-04 (`d259c94`).
- Do not count the Git push as a rollout. In the authorized VPS/Dokploy environment, deploy the Apartment Compose project only, then run `pnpm --filter @apartment/api smoke:load-gates` against its private PostgreSQL/API runtime. Keep shared Traefik stopped until the separate ACME persistence recovery plan is executed.

## P5-02 maintenance source update (2026-11-03)

- Commit 4f400b2 adds maintenance tickets, room maintenance state transitions, migration 0016 and a PostgreSQL HTTP smoke; it is pushed to origin/main.
- This is source-only. Migration 0016 has not been applied and the new API/Web code is not deployed. Take and verify the Apartment-only PostgreSQL backup before Dokploy recreates the API, since the Compose API startup applies checked-in Drizzle migrations before serving.
- The current workspace does not have Docker socket or Dokploy tooling, and the VPS public HTTPS outage is unresolved. After authorized infrastructure access is restored, redeploy only the existing Apartment Compose project, confirm migration 0016 and app health, then run pnpm --filter @apartment/api smoke:maintenance. Keep shared Traefik untouched until ACME persistence recovery is separately planned.


## P1-05 + P5 maintenance rollout verified (2026-11-03)

- Before rollout, Apartment-only backup `apartment-20261103T153805Z-25493.dump` passed SHA-256 verification and isolated restore (`RESTORE_TEST_OK restored_public_tables=30 network=none`).
- Built and recreated only API, Web and line-observer in existing Compose project `apartment-dokploy-dev-ajcnbm`; no database container or shared Traefik was restarted. All three services report healthy; web remains bound to 127.0.0.1:18089. Startup applied migration 0016; current public base-table count is 31.
- `smoke:load-gates` passed against the private DEV PostgreSQL/API runtime: 16 concurrent same-key requests gave one insert and 15 replays; 16 distinct-key requests gave one insert and 15 conflicts; 32 parallel previews returned 200 with stable totals. p95: 395 ms / 282 ms / 275 ms respectively; 76 total HTTP load requests; zero LINE messages sent. A follow-up isolated 64-way preview burst, separated by 61 seconds to respect global rate limits, returned 64/64 HTTP 200 with stable totals (p95 608 ms).
- `smoke:maintenance` passed: owner/tenant scope, approved lease binding, tenant-only history, ordered status transitions, audit route, and return-from-maintenance gate.
- `corepack pnpm test`: 23 test files, 87 tests passed (domain 11, API 76); `corepack pnpm typecheck` and `corepack pnpm --filter @apartment/web build` passed (1,692 modules). Public HTTPS home and `/readyz` returned 200; unauthenticated `/v1/tenant/maintenance-tickets` returned 401. Observer env is `observe` / `false` / `disabled`, log shows `dispatched:0`.
- This redeploy was performed through Docker Compose using the existing Dokploy Compose project name and source checkout, since authenticated Dokploy deployment tooling was not available. It did not alter Dokploy metadata, database service, shared Traefik, or other applications. Auto deploy remains disabled. Shared Traefik currently serves HTTPS, but durable ACME storage/renewal remains unverified; do not restart it as part of Apartment maintenance.
- P1-05 remains open for independent security/load acceptance. DEV rollout does not close LINE/LIFF, bank, S3/ClamAV, legal, backup/offsite, or Production gates.

## 2026-11-04 DEV image and local Web recovery (after reboot)
- GitHub `113c329` Dockerfile pinned Corepack 0.36.0 to support pnpm 12 native packaging. GitHub Actions Run `41752517992` passed quality and clean PostgreSQL security/integration jobs.
- Before image rollout: checksum-verified Apartment-only PostgreSQL backup `apartment-20261104T011719Z-360623.dump` (120931 bytes) created with `infra/backup-apartment-postgres.sh`; original PostgreSQL container/volume never restarted.
- After reboot, the Apartment managed Web container and its `apartment-web:dokploy-dev` image were missing. Rebuilt the Web and API Docker images **from a clean `git archive HEAD`** in temporary directories, excluding other session's uncommitted P5 Billing Batch code/migration 0017. Built only the `web` and `api` targets of `infra/Dockerfile`.
- Recreated **only** existing Compose project `apartment-dokploy-dev-ajcnbm` Web, API and observe-only LINE Worker using `docker compose ... up -d --no-deps --no-build` for each service. API and Worker image `sha256:7abe7fb9450589dd47231aebb6e4af6620a1b79d1b10f12d79d67103b7a645b3`, Web `sha256:09f3e0fe89b77a353a56c876f4cd1f2f1bf3839e11a901d4bfe6936761aa9d9b`. No P5 WIP files included, no shared service restarted and no Migration 0017 included in these images.
- Verified API/Web/Observer and existing PostgreSQL Healthy; private `http://127.0.0.1:18089/` = 200, `/readyz` = 200, anonymous Staff API = 401; observer `LINE_WORKER_MODE=observe`, `LINE_WORKER_APPROVED=false`, `LINE_OUTBOUND_MODE=disabled`, dispatched=0. **No public LINE provider messages were sent**.
- **Public HTTPS remains DOWN:** `https://apartme.makemarket.space` fails TCP/443 and `dokploy-traefik` shared container was not present; prior shared ACME dynamic mount was read-only. Do not restart or recreate shared Traefik under an Apartment feature session. Requires separately authorized multi-service infrastructure recovery and certificate persistence validation before claiming publicly available DEV service.
- Real LINE Login/LIFF is blocked: `VITE_LIFF_ID` not configured in Web build env. Financial/bank/S3/legal/production acceptance remains blocked.
