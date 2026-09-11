# APIFoundry

A general-purpose **mock API server** built as a testing playground: a target for API functional
testing, negative testing, automation testing, contract testing, API scenario generation, and
performance/load testing (e.g. with k6). It exposes a wide diversity of realistic HTTP patterns, auth
mechanisms, error conditions, and timing/payload behaviors, backed by an OpenAPI 3.x spec.

This is Spec 001 — **Foundation, Config & Health**: the running, empty-but-correct server every later
spec (CRUD resources, auth, HTTP testing utilities, resilience simulation, etc. — see
[ROADMAP.md](ROADMAP.md)) builds on.

## Tech stack

Node.js 20 + Express + TypeScript, in-memory only (no database), environment-variable configuration,
OpenAPI 3.x + Swagger UI, Vitest + Supertest.

## Install, configure, run

```bash
cp .env.example .env
npm install

npm run dev     # tsx watch — hot reload for development
# or
npm run build && npm start   # compiled production run
```

Server listens on `PORT` from `.env` (default `3000`). See [.env.example](.env.example) for every
configurable value (port, environment, API prefix, CORS origin, JWT/rate-limit/delay/payload/admin
settings consumed by later specs).

## Run the tests

```bash
npm test
```

## Endpoints implemented in this spec

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Combined health status |
| GET | `/health/live` | Liveness probe (always `ok` while the process runs) |
| GET | `/health/ready` | Readiness probe (`503` until startup completes) |
| GET | `/version` | Application version and environment |
| GET | `{API_PREFIX}/info` (default `/api/v1/info`) | Running instance info (name, version, environment, apiPrefix, uptime) |
| GET | `/openapi.json` | OpenAPI document as JSON |
| GET | `/openapi.yaml` | OpenAPI document as YAML |
| GET | `/docs` | Swagger UI |

Every response (success or error) carries an `X-Request-ID` header. Every error response uses the shared
envelope:

```json
{ "error": { "code": "RESOURCE_NOT_FOUND", "message": "...", "details": {}, "requestId": "..." } }
```

See [specs/001-foundation-platform/](specs/001-foundation-platform/) for the full spec, plan, data
model, OpenAPI contract, and quickstart validation guide for this slice.
