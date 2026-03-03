# API Hardening & Runtime Controls

This document defines production security/runtime defaults introduced in the hardening release.

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
- Optional tier prefixes supported: `free:key_a,pro:key_b`

If missing in production:
- Non-health endpoints fail closed with `503`.

## Rate Limiting

Production rate limits use Redis-backed sliding windows.

Required env in production:
- `THEOREMIS_REDIS_URL`
- `THEOREMIS_REDIS_TOKEN`

Optional tuning:
- `THEOREMIS_RATE_LIMIT_WINDOW_SEC` (default: `60`)
- `THEOREMIS_RATE_LIMIT_FREE` (default: `100`)
- `THEOREMIS_RATE_LIMIT_PRO` (default: `10000`)

Behavior:
- Keyed by `tier + key` in production.
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
