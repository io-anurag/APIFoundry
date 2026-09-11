# Quickstart: Foundation, Config & Health

**Feature**: `001-foundation-platform`

Validates the foundation layer end-to-end: server starts from config, health/version/info endpoints
respond correctly, every response carries a request id, and errors use the shared envelope. Schemas are
defined in [data-model.md](data-model.md); endpoint contracts in
[contracts/foundation.openapi.yaml](contracts/foundation.openapi.yaml).

## Prerequisites

- Node.js 20.x
- Repo cloned, dependencies not yet installed

## Setup

```bash
cp .env.example .env
npm install
```

## Run

```bash
npm run dev
# Server listening on http://localhost:3000 (or PORT from .env)
```

## Validate — manual smoke test

```bash
# Combined health
curl -i http://localhost:3000/health
# Expect: 200, body matches HealthStatus, X-Request-ID header present

# Liveness / readiness
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready

# Version
curl -i http://localhost:3000/version

# Versioned API info
curl -i http://localhost:3000/api/v1/info

# Undefined route -> shared error envelope
curl -i http://localhost:3000/api/v1/does-not-exist
# Expect: 404, body shape { "error": { "code", "message", "details", "requestId" } }

# Unsupported method on a defined route -> 405
curl -i -X POST http://localhost:3000/health
# Expect: 405, same error envelope

# Malformed JSON body -> 400, process keeps serving
curl -i -X POST http://localhost:3000/api/v1/info -H "Content-Type: application/json" -d '{not-json'
# Expect: 400, same error envelope; a follow-up curl to /health still returns 200

# CORS: request from a disallowed origin (only meaningful if CORS_ORIGIN is set to a specific
# allow-list rather than *)
curl -i -H "Origin: https://not-allowed.example" http://localhost:3000/health
```

## Validate — configuration isolation

```bash
# Terminal A
PORT=4000 CORS_ORIGIN=https://a.example npm run dev

# Terminal B
PORT=4100 CORS_ORIGIN=https://b.example npm run dev
```

Confirm each instance only accepts its own configured port/origin, with no source changes between them
(SC-004).

## Validate — startup fails fast on bad config

```bash
PORT=not-a-number npm start
# Expect: process exits immediately with a clear, actionable error naming the invalid field;
# no partial startup, no listening socket left open.
```

## Automated tests

```bash
npm test
```

Expect the full foundation suite (health/liveness/readiness/version/info, error-envelope and
request-id assertions, malformed-input handling) to pass in under 30 seconds (SC-006).

## Docs surface

```bash
open http://localhost:3000/docs        # Swagger UI
curl http://localhost:3000/openapi.json
curl http://localhost:3000/openapi.yaml
```

Confirm the endpoints documented match exactly what Spec 001 implements (health/live/ready, version,
`/api/v1/info`) — no more, no less.
