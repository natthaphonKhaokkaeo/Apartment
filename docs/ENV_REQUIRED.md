# Apartment — Environment / Keys Checklist

> Updated 2026-11-03. Never paste secrets into chat or commit them. Read docs/PHASES.md for verified feature status.

## A. Required for real LINE Login (not yet configured)

| Variable | Place to set | Where to get it | Classification |
|---|---|---|---|
| `LINE_CHANNEL_ID` | root .env | **LINE Login Channel ID** from LINE Developers → LINE Login → Basic settings (**not** Messaging API Channel ID) | Public identifier |
| `VITE_LIFF_ID` | apps/web/.env or frontend build env | LINE Developers → LIFF App; enable **openid** scope and HTTPS endpoint | Public client ID |
| `SUPER_ADMIN_LINE_USER_ID` | root .env | Trusted account's verified LINE User ID (not guessed or copied from an untrusted request) | Sensitive identifier |
| `WEB_ORIGIN` | root .env | Actual approved HTTPS origin, e.g. https://apartment.example.com (placeholder only) | Public URL |
| `COOKIE_SECURE` | root .env | true for HTTPS; false for localhost HTTP in DEV only | Configuration |

Real LINE Login / LIFF Sandbox E2E is **blocked** until these values and the real HTTPS endpoint are configured.

## B. Database, API, and private payment evidence (DEV)

| Variable | Status | Instructions |
|---|---|---|
| `NODE_ENV` | Used | development in DEV. Production intentionally fails startup until private production storage and security review are implemented |
| `APARTMENT_DB_PASSWORD` | Used by infra/compose.dev.yaml | Strong random password already privately generated on the VPS. Do not disclose or commit |
| `DATABASE_URL` | Used | Dedicated Apartment PostgreSQL connection string; sensitive |
| `HOST` | Used | 127.0.0.1 in DEV; only expose through secure proxy later |
| `PORT` | Used | Default 8088 |
| `PAYMENT_EVIDENCE_DIR` | Optional; implemented for DEV | Absolute directory outside public web root; mode 0700, files 0600; persistent storage and backup. If unset code uses an ignored private project directory |
| `PAYMENT_GATEWAY_API_KEY` | Not used or required | There is no bank/gateway API integration. No auto-confirmation |

Bank name, account holder, account number and optional PromptPay **belong in Property Payment Settings inside the app**, not ENV. Information should be independently verified before tenants transfer money.

## C. Future Phase P4 LINE OA messaging (NOT IMPLEMENTED)

These are proposed ENV names that are NOT read by the current code:

| Proposed variable | Source | Intended use |
|---|---|---|
| `LINE_MESSAGING_CHANNEL_SECRET` | LINE Developers → Messaging API channel basic settings | Raw-body webhook signature verification |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | LINE Developers → Messaging API channel | Outbound messaging |
| `LINE_WEBHOOK_PUBLIC_URL` | Future HTTPS API | Register webhook in provider |

OA topology is pending user choice: provisional one OA per owner organization; multiple properties attached. Supporting many OAs may require per-organization secrets, not a single global ENV.

## D. P3 S3-compatible storage with signed upload (IMPLEMENTED; PROVIDER E2E BLOCKED)

The API now **reads** these ENV names when `EVIDENCE_STORAGE_DRIVER=s3`:

| ENV | Required? | Explanation |
|---|---|---|
| `EVIDENCE_STORAGE_DRIVER` | Yes to enable | `local` (DEV default) or `s3` |
| `EVIDENCE_S3_BUCKET` | Yes with s3 | Private bucket, never public, with required scoped IAM and CORS |
| `EVIDENCE_S3_REGION` | Yes with s3 | Storage region, e.g. `ap-southeast-1` if provider supports it |
| `EVIDENCE_S3_ACCESS_KEY_ID` | Yes with s3 | Limited-scope service credential, keep in secret manager |
| `EVIDENCE_S3_SECRET_ACCESS_KEY` | Yes with s3 | Corresponding private secret |
| `EVIDENCE_S3_ENDPOINT` | For compatible provider | HTTPS endpoint from storage vendor; omit for AWS S3 |
| `EVIDENCE_S3_FORCE_PATH_STYLE` | Optional | `true` for providers that require path style; default false |

For real provider browser testing, bucket CORS must allow `PUT` from exact `WEB_ORIGIN`, plus `content-type`, `content-length`, and `x-amz-checksum-sha256` headers. Consult `docs/P3_S3_STORAGE_RUNBOOK.md` before any configuration.

Backend implements a 5-minute presigned quarantine PUT, SHA-256 and size verification, metadata stripping via WebP re-encoding, and single-use upload ticket binding. The local HTTP S3 mock smoke test passes. **A real provider's IAM/bucket policy/SigV4/CORS has NOT been tested yet**, and production startup intentionally remains disabled pending security controls (malware scanning, backup/restore, lifecycle, retention). Storage credentials are not needed to run DEV in default `local` mode.

## E. Future receipts / tax / bank reconciliation (NOT IMPLEMENTED)

No real-bank API, payment provider, tax receipt API, refunds or e-tax integration. Therefore no external finance API key is needed now. Official receipt issuer, tax identifier, regulatory requirements and refund/credit policy remain product/legal decisions.

## F. When you are ready to set ENV

1. Update /root/Projects/Apartment/.env for backend secret/configuration (ignored by Git).
2. Update /root/Projects/Apartment/apps/web/.env for `VITE_LIFF_ID` and rebuild. This is a **public client ID**, not a server secret.
3. Configure real HTTPS origin and LIFF callback in LINE Developers.
4. Run tests, typecheck, web build, database/API smoke and actual LINE sandbox E2E before claiming end-to-end readiness.
5. For DEV evidence backups, snapshot private evidence directory consistently with Postgres data.

**Currently needed for real LINE end-to-end:** LINE Login Channel ID, LIFF ID, Super Admin LINE user subject, and approved HTTPS origin. **No payment gateway key is required.**

## G. Decisions to confirm later

- One LINE OA per organization vs per property
- Owner payment account/PromptPay, refunds vs held credit for overpayments
- Rent in advance vs after period and tenant/owner legal identity
- Figma team: personal vs SKY ICT


## H. P3-05b informational PDF (implemented)
No additional environment variables or credentials are required. The API depends on the npm package @expo-google-fonts/noto-sans-thai and pdfkit at runtime, and embeds the Thai font in the PDF. Official receipts/tax documents still require policy and legally verified issuer/tax identity before implementation.


## I. PromptPay QR configuration (P3-01b)
No new ENV / external API key is required. The authorized organization owner sets a 10-digit Thai mobile or 13-digit tax/national PromptPay proxy via the property Payment Settings UI, not in environment files. App bank-registration verification and real bank-app scan are **not implemented**. LINE Login and HTTPS remain separate sandbox ENV requirements.

## J. Optional P3 malware scanner
DEV default: EVIDENCE_MALWARE_SCANNER=disabled (images explicitly NOT virus scanned). To enable actual scanner: EVIDENCE_MALWARE_SCANNER=clamav, CLAMAV_HOST=127.0.0.1, CLAMAV_PORT=3310, CLAMAV_TIMEOUT_MS=5000. Provision clamd and signature updates separately on a private network; mock TCP tests only so far. No scanner secret key required. Production startup remains blocked.

## K. Dokploy and finance DEV
No new finance API keys. Dokploy API requires an authenticated x-api-key generated under Settings > Profile > API/CLI, or an authorized Dashboard login; it is an operator secret and NOT an application ENV variable. VITE_LIFF_ID is a public *build-time* variable. Real LINE_CHANNEL_ID, WEB_ORIGIN exact HTTPS domain and COOKIE_SECURE=true remain pending for public LIFF testing. See docs/DEPLOY_DOKPLOY_DEV.md.
\n## L. LINE OA webhook/outbox P4 (new code, no real key yet)\n- LINE_MESSAGING_CHANNEL_SECRET: secret key for verifying LINE x-line-signature, not LINE Login Channel Secret\n- LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: token required only if enabling live outbound messages\n- LINE_OA_BOT_USER_ID: exact U + 32 hex LINE Messaging API bot User ID used as webhook destination (one configured OA per API instance in DEV)\n- LINE_OUTBOUND_MODE: disabled (default), simulate (no real message), or live (needs explicit token and CLI confirmation)\n- LINE_WEBHOOK_PUBLIC_URL: **not read by app**; supply verified HTTPS URL in LINE Developers portal when ready\nKeep all secrets in Dokploy/secret manager, not Git. P4 worker is not deployed/scheduled. See docs/P4_LINE_OA_WEBHOOK_OUTBOX.md.\n
## Public DEV domain setup
Configured WEB_ORIGIN=https://apartme.makemarket.space and COOKIE_SECURE=true in private runtime ENV. No new API key needed for domain itself. Real LINE Login/LIFF IDs remain required. Traefik ACME storage mount is read-only; durable certificate renewal requires separate maintenance.

## P4-04 tenant consent and invoice/due notifications
No new required ENV or API key. Tenant opt-in requires a verified enabled OA binding (LINE_OA_BOT_USER_ID + LINE_MESSAGING_CHANNEL_SECRET configured and admin-bound) and authenticated LINE-linked active lease. The server default LINE_OUTBOUND_MODE=disabled continues to protect against sending messages. Real LINE Login/LIFF and OA credentials are required separately for real device tests. Due reminder CLI is manual / DRY_RUN by default; it neither calls LINE nor runs automatically.

## P4-03c Safe LINE observer
No new key required. Optional future worker controls: LINE_WORKER_MODE=observe, LINE_WORKER_APPROVED=false, LINE_WORKER_INTERVAL_MS=60000 (between 30000 and 300000). LIVE also needs LINE_OUTBOUND_MODE=live and verified Messaging API credentials. **DEV Compose overrides these controls to observe/false/disabled**, so no LINE messages can be sent by this observer. Never enable without real provider, consent, quota/fairness and incident acceptance.
