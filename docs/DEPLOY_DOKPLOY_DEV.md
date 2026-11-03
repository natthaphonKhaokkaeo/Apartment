# Apartment — Dokploy DEV deployment handoff

**2026-11-03:** GitHub main has been pushed. Docker Compose API and web containers run **locally on VPS**, web bound to `127.0.0.1:18088`, and health checks returned HTTP 200. **Not yet registered inside the Dokploy Dashboard**, because Dokploy API returns 401 without a user API key. Do not call this Dokploy-managed or publicly deployed.

## Architecture

- Source: `git@github.com:natthaphonKhaokkaeo/Apartment.git` branch main
- Source files: root `docker-compose.dokploy.yml`, `infra/Dockerfile`, `infra/nginx.dev.conf`, `.dockerignore`
- Runtime: API + Web in Docker, existing separate DEV PostgreSQL from `apartment-dev-postgres-1` via network `apartment-dev_default`. **No second database** and no shared DB data-volume mount.
- Web port bound to **127.0.0.1:18088 only**. API is internal Docker networking. Never expose directly before HTTPS/LINE security gates.
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
