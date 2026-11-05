# Dependency audit — 2026-11-05

Actual command: `corepack pnpm audit --json`; release gate `corepack pnpm audit --audit-level high`.

Result: 0 critical, 0 high, 6 moderate. This satisfies the requested high/critical gate; it is not a claim of zero vulnerabilities.

| Package | Audit finding | Reported patched version |
|---|---|---|
| esbuild | Development server cross-origin request disclosure | >=0.25.0 |
| vitest | Mocker redirect path traversal/arbitrary read | >=4.1.11 |
| @vitest/mocker | Mocker redirect path traversal/arbitrary read | >=4.1.11 |
| @vitest/mocker | Unauthenticated manual mock registration/code injection | >=4.1.12 |
| glob | AbortSignal cancellation bypass / post-timeout traversal | >=14.0.2 |
| minimatch | Globparts amplification denial of service | >=11.0.1 |

These require dependency-chain review and compatibility validation, especially the major Vitest upgrade. No advisory was ignored, removed from the report or excluded to satisfy a gate. Do not expose development/test servers publicly. Runtime DEV continues to use built application images behind existing HTTPS routing.
