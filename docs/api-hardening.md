# API Hardening & Runtime Controls

This document defines production security/runtime defaults introduced in the hardening release.

## Formal Verification v2 Runtime

Canonical formal endpoints:
- `POST /api/v2/verify`
- `GET /api/v2/jobs/:id`
- `POST /api/v2/translate/latex`
- `GET /api/v2/health`

Formal verification is accepted only when the Lean checker reports success and obligations are zero:
- `sorryCount = 0`
- `admitCount = 0`
- `unsolvedGoals = 0`

Relevant env:
- `THEOREMIS_V2_VERIFY_ENABLED` (default: enabled)
- `THEOREMIS_V2_ALLOW_IN_MEMORY_QUEUE` (development helper; production should use external queue policy)
- `THEOREMIS_V2_QUEUE_CONCURRENCY`
- `THEOREMIS_V2_MAX_FILES`
- `THEOREMIS_V2_MAX_FILE_BYTES`
- `THEOREMIS_V2_MAX_TOTAL_BYTES`
- `THEOREMIS_V2_MIN_TIMEOUT_MS`
- `THEOREMIS_V2_MAX_TIMEOUT_MS`
- `THEOREMIS_V2_MIN_MEMORY_MB`
- `THEOREMIS_V2_MAX_MEMORY_MB`
- `THEOREMIS_LEAN_PROJECT` (Lean + Lake project root used by checker invocation)

Production behavior:
- Fails closed if formal verification is disabled.
- Fails closed if queue policy disallows in-memory mode and no external queue is configured.
- Fails closed if Lean checker runtime dependencies are unavailable.

## Type-Check Modes

Supported request field:
- `typeCheckMode`: `"permissive"` or `"strict"`

Accepted on:
- `POST /api/v1/parse`
- `POST /api/v1/analyze`
- `POST /api/v1/pipeline`
- `POST /api/v1/grade`

Behavior:
- `permissive` keeps IDE-friendly fallback inference behavior.
- `strict` turns unresolved/fallback typing paths into hard errors and emits strict diagnostics metadata.

Defaults:
- Development: `permissive` unless explicitly set.
- Production analyze/pipeline/grade: default `strict` if field omitted.

## Strict Diagnostics Metadata

When strict mode is active:
- Parse responses include `strictDiagnostics` (additive field).
- Analyze/pipeline analysis includes `strictDiagnostics` (additive field).

Metadata fields:
- `mode`
- `errorCount`
- `fallbackErrors`
- `unresolvedTermErrors`
- `universeErrors`

## Production Auth Policy

Production requires configured API keys for all non-health endpoints.

Required env:
- `THEOREMIS_API_KEYS`

Format:
- Comma-separated tokens, e.g. `key_a,key_b`

If missing in production:
- Non-health endpoints fail closed with `503`.

## Rate Limiting

Production rate limits use Redis-backed sliding windows.

Required env in production:
- `THEOREMIS_REDIS_URL`
- `THEOREMIS_REDIS_TOKEN`

Optional tuning:
- `THEOREMIS_RATE_LIMIT_WINDOW_SEC` (default: `60`)
- `THEOREMIS_RATE_LIMIT_ANONYMOUS` (default: `100`)
- `THEOREMIS_RATE_LIMIT_AUTHENTICATED` (default: `10000`)

Behavior:
- Keyed by `authLevel + key` in production.
- Development may fall back to in-memory buckets.
- Health endpoint is excluded.
- Standard headers are emitted:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Analyze Guardrails

Analyze/pipeline requests support:
- `timeoutMs`
- `maxWorkItems`

When limits trigger:
- Response includes `truncated: true`
- `truncationReason` is included as additive metadata.

Server execution:
- CPU-heavy analyze/pipeline work runs inside a bounded worker-thread task.

## Legacy API Policy

Legacy analysis endpoints remain available during deprecation:
- `POST /api/v1/analyze`
- `POST /api/v1/pipeline`

Both endpoints emit:
- `X-Theoremis-Legacy: true`
- additive response field `mode: "legacy-analysis"`

These legacy endpoints do not represent formal verification truth.
