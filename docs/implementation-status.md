# Apartment implementation status — 2026-11-03

`docs/PHASES.md` is the canonical plan and handoff. This file is a short mirror; do not maintain a second checklist here.

## Current state

- DEV implementation is through P1-04 staff authorization; deployed baseline commit is `d259c94`.
- P1-05 amount, storage-bound, duplicate, idempotency and concurrency gates are **in progress** in pushed commit `c0dedbc` (not deployed). `assertInvoiceStorageBounds` guards PostgreSQL INTEGER snapshots, utility arithmetic overflow maps to HTTP 422, six unit cases pass, and `apps/api/scripts/smoke-load-gates.ts` covers negative/fractional inputs, duplicate readings, cross-org denial, concurrent billing races and a bounded 32-way preview burst (76 HTTP requests total).
- Domain unit tests pass 11/11; API tests pass 73/73 when excluding the loopback-dependent malware scanner suite; monorepo typecheck and Web production build pass. The full unit run has two malware scanner integration tests failing because loopback listeners are denied by the sandbox (`EPERM`). The `.env` contains the DEV `DATABASE_URL`, but the P1-05 HTTP smoke fails its API readiness check (`DEV API not ready`); Docker socket access is also denied. P5 maintenance smoke was not run because it requires the same unavailable private HTTP/database runtime. No PostgreSQL HTTP smoke completed. P5 maintenance API/UI, migration 0016, and smoke source remain uncommitted; migration is not applied.
- Do not mark P1-05 complete until its PostgreSQL HTTP/concurrency smoke and load run have passed in the authorized DEV runtime. Deployment was not triggered; the current workspace has no Docker socket access or Dokploy tool, and auto deploy is disabled.
- Current public deployment is **down** after the VPS reboot: shared `dokploy-traefik` exited with code 255; no host 80/443 listeners. Apartment containers were last verified healthy internally at `127.0.0.1:18089`. Do not restart shared Traefik until ACME persistence is repaired under a separate infrastructure maintenance plan.
- LINE worker remains observe-only, approval false, outbound disabled. No LINE messages were sent.

## Completed implementation

P0 foundation; P1-01a move-out, P1-02 effective-dated property rates, P1-03a/b room rates and partial billing, P1-03c meter replacement and partial move-out, P1-04 property staff access; P2 invite/claim/approval portal; P3 DEV payment claims, ledger, financial review, PromptPay QR builder, private/S3-mock evidence workflow and non-tax Billing Notice PDF; P4 signed webhook/outbox, tenant consent, observe-only operations, quotas, alerts and reservation retention.

These are DEV implementations. Their provider, legal, financial, reliability, load, or Production gates remain open where listed in `docs/PHASES.md`.

## Next work

1. Finish P1-05 using the private PostgreSQL HTTP and concurrency smoke, then an agreed bounded load run.
2. Continue P1-01b/P5 maintenance, deposits, settlement, bulk billing and tenant operations.
3. Keep LINE/LIFF, bank, S3/ClamAV, legal/tax, independent security, offsite backup, Figma and Production acceptance blocked until their required credentials, decisions and external verification exist.

Never treat a manual payment approval as bank-verified funds, issue an official receipt/tax invoice without legal approval, or enable live LINE sending from the DEV observer.
