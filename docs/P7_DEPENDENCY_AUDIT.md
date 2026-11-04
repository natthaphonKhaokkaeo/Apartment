# Dependency security audit — Apartment DEV (2026-11-04)

This is a verified npm registry/pnpm audit of the repo dependency tree, **not** a full SAST/DAST or security certification. The current lockfile remains the source of reproducible versions. No external secrets, live LINE calls or real bank transactions were used.

## Finding and remediation

Before remediation, `corepack pnpm audit --audit-level high --json` reported **2 Critical, 5 High, 6 Moderate** advisories. The High/Critical advisories affected these installed dependency families:

| Package | Old installed version | Security override / patched version |
| --- | --- | --- |
| `tinypool` (Vitest worker, development) | 1.1.1 | 2.1.2 |
| `drizzle-orm` (runtime SQL ORM) | 0.44.7 | 0.45.2 |
| `sharp` (runtime image processing) | 0.34.5 | 0.35.5 |
| `pdfjs-dist` (test PDF rendering) | 5.7.284 | 6.2.108 |

Overrides are centralized in `pnpm-workspace.yaml` so the other session's uncommitted P5 Bulk Billing changes to `apps/api/package.json` are not overwritten. Direct dependency manifest ranges should be reconciled with the overrides after that session commits. Bumps are intentionally not represented as backward-compatible guarantees; testing is required.

After `pnpm install --frozen-lockfile` and audited lockfile resolution:

- `corepack pnpm audit --audit-level high --json`: **0 Critical, 0 High; 6 Moderate**.
- `corepack pnpm test`: **76/76 API unit tests and 15/15 domain tests pass** (after 4 additional date/money/meter boundary tests).
- `corepack pnpm typecheck`: **pass**.
- `corepack pnpm --filter @apartment/web build`: **pass**.
- `corepack pnpm lint`: **0 errors, 37 warnings**.
- **Verified on GitHub-hosted Actions Run 41751709175 (commit `f9c9e54`): both quality and clean PostgreSQL integration/security jobs passed** with these overrides. No production deployment is implied.

CI now blocks future **High or Critical** pnpm audit advisories. Six **Moderate** advisories still require triage and remediation; do not label the dependency tree fully vulnerability-free.

## Coverage measured, not waived

- API Vitest unit coverage: **29.28% lines/statements**, **81.75% branches**, **67.76% functions**.
- Domain Vitest unit coverage: **100% lines/statements**, **96.42% branches** (15 Domain tests), **100% functions**.
- Integration HTTP smoke (separate child process) is not included in these Vitest unit coverage percentages; do **not** inflate claims by excluding relevant app routes from total measurement.
- The overall P7 coverage requirement remains **OPEN** until meaningful total coverage reaches 80% and the CI threshold is enforced. Owner/tenant Playwright browser E2E remains OPEN.

## Safety boundaries

- DEV only, no production deploy. On 2026-11-04, patched API/observe-only Worker images were rebuilt from committed source and deployed in the Apartment-only DEV Compose project after a checksum-verified database backup. API/Web/Worker and PostgreSQL are Healthy internally; public HTTPS remains unavailable due to missing shared Traefik. See `docs/DEPLOY_DOKPLOY_DEV.md`.
- No migration applied for concurrently uncommitted P5 Billing Batch migration 0017.
- Existing Traefik/Dokploy infrastructure was not modified by this audit.
- This is not a substitute for dependency ownership, license review, external provider testing or independent security acceptance.
