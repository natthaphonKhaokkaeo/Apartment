# Apartment — LINE setup for apartme.makemarket.space

## Browser origin / API
- Public web origin: `https://apartme.makemarket.space`
- Current Fastify API endpoints share this origin through `infra/nginx.dev.conf` (`/v1/` is proxied to port 8088).
- Root `.env`: `WEB_ORIGIN=https://apartme.makemarket.space`, `COOKIE_SECURE=true`.
- HTTPS must be terminated by the external reverse proxy. An actual public connection to port 443 was **not** available during validation on 2026-11-04; investigate DNS/Traefik/firewall/cert before setting LINE webhook to verified/live.

## LINE Login / LIFF — LINE Developers Console
1. Create or select a **LINE Login** channel, and set `LINE_CHANNEL_ID` from its Channel ID on the API. No backend OAuth callback handler is implemented; the backend receives LIFF ID tokens through `POST /v1/auth/line/exchange` after verification with LINE, **not** a browser redirect.
2. In the channel's LIFF tab create a LIFF app with **Endpoint URL** `https://apartme.makemarket.space/`, and copy its LIFF ID into the web **build-time** `VITE_LIFF_ID` (or Docker `--build-arg VITE_LIFF_ID=...`). LIFF SDK calls `liff.login({redirectUri:window.location.href})`, returning to the page the user opened. Root `/` is the supported entry path; no separate `/callback` route exists.
3. If the LINE Login Channel settings require an OAuth Callback URL, use `https://apartme.makemarket.space/` for the configured frontend entry and verify LINE's validation rules. Do not configure `/v1/auth/line/exchange` as a redirect callback; that route is POST-only.

## LINE Messaging API channel — LINE Developers Console
- **Webhook URL:** `https://apartme.makemarket.space/v1/line/oa/webhook`
- Enable **Use webhook** in Messaging API settings, then run the **Verify** action after HTTPS public routing is online and the channel secret is correct.
- Configure API secret `LINE_MESSAGING_CHANNEL_SECRET` and access token `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, and check bot user ID (`LINE_OA_BOT_USER_ID`, `U` followed by 32 hex digits) from provider data.
- Do not enable live outbound until consent, quotas, delivery worker review and provider E2E are approved. `LINE_OUTBOUND_MODE=disabled`, `LINE_WORKER_MODE=observe`, `LINE_WORKER_APPROVED=false` are safe defaults.

## Operator checks
- Public: `curl -I https://apartme.makemarket.space/`
- API health: `curl -i https://apartme.makemarket.space/healthz`
- Webhook path must be HTTPS-reachable. Do **not** test by directly GETting webhook as if it were a browser page: it is signed LINE POST-only and unsigned requests must fail verification.
- Restart/redeploy API only after env review; rebuild/redeploy web with build-time `VITE_LIFF_ID` after LIFF app exists.
- Never put LINE channel secret or Messaging API access token into frontend `VITE_*` variables.
