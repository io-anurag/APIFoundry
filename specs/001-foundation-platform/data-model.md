# Phase 1 Data Model: Foundation, Config & Health

**Feature**: `001-foundation-platform` | **Date**: 2026-09-11

This spec introduces no persisted business resources (no store, no CRUD). The "entities" below are the
shared runtime shapes and configuration contract that every later spec builds on — they live in
`src/models/` (shared response envelopes) and `src/config/` (the configuration schema).

## ConfigurationProfile

The validated, typed result of parsing `process.env` once at startup (`src/config/`). Frozen after
validation; every module reads from this object rather than `process.env` directly, so a missing/invalid
value is caught at startup (FR-013) instead of at first use.

| Field | Type | Default | Notes |
|---|---|---|---|
| `port` | number (1–65535) | `3000` | From `PORT` |
| `nodeEnv` | enum: `development` \| `test` \| `production` | `development` | From `NODE_ENV` |
| `apiPrefix` | string, non-empty, leading `/` | `/api/v1` | From `API_PREFIX`; used to mount all resource routers |
| `corsOrigin` | string | `*` | From `CORS_ORIGIN`; `*` or a comma-separated allow-list |
| `jwtSecret` | string, non-empty | `change-me` | From `JWT_SECRET`; never logged (defined here, consumed starting Spec 005) |
| `jwtIssuer` | string | `mock-api-server` | From `JWT_ISSUER` |
| `jwtAudience` | string | `mock-api-client` | From `JWT_AUDIENCE` |
| `jwtExpiresIn` | number (seconds) | `3600` | From `JWT_EXPIRES_IN` |
| `rateLimitEnabled` | boolean | `false` | From `RATE_LIMIT_ENABLED` |
| `rateLimitRequests` | number | `100` | From `RATE_LIMIT_REQUESTS` |
| `rateLimitWindowMs` | number | `60000` | From `RATE_LIMIT_WINDOW_MS` |
| `maxDelayMs` | number | `10000` | From `MAX_DELAY_MS` |
| `maxPayloadSize` | string (byte-size literal, e.g. `10mb`) | `10mb` | From `MAX_PAYLOAD_SIZE` |
| `failureRate` | number (0–1) | `0` | From `FAILURE_RATE` |
| `adminToken` | string, non-empty | `admin-secret` | From `ADMIN_TOKEN`; never logged |

**Validation rules**: every field is validated by a single schema at process startup; any missing
required value or value that fails its type/range check aborts startup with one aggregated, human-readable
error (FR-013) — the process never starts partially configured. Fields consumed only by later specs
(`jwtSecret` through `adminToken`) are still validated here so the schema has exactly one owner.

## HealthStatus

The payload returned by the liveness/readiness/combined-health endpoints. Not persisted — computed
per-request from in-process state (has the app finished its startup sequence?).

| Field | Type | Notes |
|---|---|---|
| `status` | enum: `ok` \| `not-ready` | `ok` once the process has completed startup; readiness endpoint is the only one that can report `not-ready` |
| `uptimeSeconds` | number | Process uptime at response time |
| `timestamp` | ISO 8601 string | Response generation time |

## VersionInfo

Returned by `GET /version`.

| Field | Type | Notes |
|---|---|---|
| `version` | string | Read from `package.json` at startup, not hardcoded |
| `nodeEnv` | string | Current `ConfigurationProfile.nodeEnv` |

## ApiInfo

Returned by `GET /api/v1/info`.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Application name (from `package.json`) |
| `version` | string | Same source as `VersionInfo.version` |
| `environment` | string | `ConfigurationProfile.nodeEnv` |
| `apiPrefix` | string | `ConfigurationProfile.apiPrefix`, so clients can discover the mount point |
| `uptimeSeconds` | number | Process uptime at response time |

No secret configuration fields (`jwtSecret`, `adminToken`, etc.) are ever included in this payload.

## ErrorEnvelope

The single shape every error response uses, project-wide (constitution Principle III). Defined once in
`src/models/` and produced only by the central error-handling middleware.

| Field | Type | Notes |
|---|---|---|
| `error.code` | string (SCREAMING_SNAKE_CASE) | Machine-readable, e.g. `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `METHOD_NOT_ALLOWED`, `INTERNAL_ERROR` |
| `error.message` | string | Human-readable summary, safe to display |
| `error.details` | object | Optional structured context (e.g. which field failed validation); `{}` when not applicable |
| `error.requestId` | string (UUID) | Same id as the response's `X-Request-ID` header |

## PaginationEnvelope

The single shape every future list endpoint will wrap its results in (constitution Principle III).
Defined here so Spec 002 onward reuses it verbatim; no endpoint in this spec produces one yet.

| Field | Type | Notes |
|---|---|---|
| `data` | array | The page of results |
| `pagination.page` | number | 1-indexed current page |
| `pagination.limit` | number | Page size |
| `pagination.total` | number | Total matching items across all pages |
| `pagination.totalPages` | number | `ceil(total / limit)` |
| `pagination.hasNext` | boolean | Whether a page after this one exists |
| `pagination.hasPrevious` | boolean | Whether a page before this one exists |

## RequestLogEntry

The structured record `pino-http` emits per request (not persisted beyond the log stream).

| Field | Type | Notes |
|---|---|---|
| `timestamp` | ISO 8601 string | Request completion time |
| `requestId` | string (UUID) | Same id attached to the response and to `ErrorEnvelope.error.requestId` when applicable |
| `method` | string | HTTP method |
| `url` | string | Request path (+ query string) |
| `status` | number | Response status code |
| `responseTimeMs` | number | Duration from request receipt to response finish |

**Constraint**: this shape MUST NEVER include header/body values that could carry secrets (Authorization
headers, cookies, request bodies) — only the fields listed above are logged.

## Relationships

- Every HTTP response produced by the app carries the `X-Request-ID` that also appears in
  `ErrorEnvelope.error.requestId` (for errors) and in the matching `RequestLogEntry.requestId` — this is
  the single correlation key across responses and logs.
- `HealthStatus`, `VersionInfo`, and `ApiInfo` all derive from the same `ConfigurationProfile` and process
  start time; none has its own persisted state.
