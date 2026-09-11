# APIFoundry

[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.x-6BA539?logo=openapiinitiative&logoColor=white)](https://www.openapis.org/)
[![Vitest](https://img.shields.io/badge/Vitest-testing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-enabled-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/io-anurag/APIFoundry/actions/workflows/ci.yml/badge.svg)](https://github.com/io-anurag/APIFoundry/actions/workflows/ci.yml)
[![stars - APIFoundry](https://img.shields.io/github/stars/io-anurag/APIFoundry?style=social)](https://github.com/io-anurag/APIFoundry)
[![forks - APIFoundry](https://img.shields.io/github/forks/io-anurag/APIFoundry?style=social)](https://github.com/io-anurag/APIFoundry)
[![GitHub tag](https://img.shields.io/github/tag/io-anurag/APIFoundry?include_prereleases=&sort=semver&color=blue)](https://github.com/io-anurag/APIFoundry/releases/)
[![issues - APIFoundry](https://img.shields.io/github/issues/io-anurag/APIFoundry)](https://github.com/io-anurag/APIFoundry/issues)

A general-purpose **mock API server** built as a testing playground: a target for API functional
testing, negative testing, automation testing, contract testing, API scenario generation, and
performance/load testing (e.g. with k6). It exposes a wide diversity of realistic HTTP patterns, auth
mechanisms, error conditions, and timing/payload behaviors, backed by an OpenAPI 3.x spec.

Specs implemented so far:

- **001 — Foundation, Config & Health**: the running, empty-but-correct server every later spec builds
  on (config, cross-cutting middleware, health/version/info, OpenAPI + Swagger UI skeleton).
- **002 — Core CRUD Resources**: full CRUD for `users`, `products`, `customers`, `orders`, backed by
  deterministic seed data, with pagination/sorting/filtering and comprehensive input validation.

Auth, HTTP testing utilities, resilience simulation, and the rest of the surface are tracked in
[ROADMAP.md](ROADMAP.md).

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

## Endpoints

### Meta (Spec 001)

| Method | Path                                         | Description                                                           |
| ------ | -------------------------------------------- | --------------------------------------------------------------------- |
| GET    | `/health`                                    | Combined health status                                                |
| GET    | `/health/live`                               | Liveness probe (always `ok` while the process runs)                   |
| GET    | `/health/ready`                              | Readiness probe (`503` until startup completes)                       |
| GET    | `/version`                                   | Application version and environment                                   |
| GET    | `{API_PREFIX}/info` (default `/api/v1/info`) | Running instance info (name, version, environment, apiPrefix, uptime) |
| GET    | `/openapi.json`                              | OpenAPI document as JSON                                              |
| GET    | `/openapi.yaml`                              | OpenAPI document as YAML                                              |
| GET    | `/docs`                                      | Swagger UI                                                            |

### Core resources (Spec 002)

Each of the four resources below supports the full set of operations under `{API_PREFIX}` (default
`/api/v1`):

| Method | Path                                                               | Description                                                                                                                            |
| ------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/users`, `/products`, `/customers`, `/orders`                     | Paginated list — `page`, `limit`, `sort` (`field` or `-field`), plus one filter per resource (`role`, `category`, `country`, `status`) |
| GET    | `/users/{id}`, `/products/{id}`, `/customers/{id}`, `/orders/{id}` | Get one by id                                                                                                                          |
| POST   | `/users`, `/products`, `/customers`, `/orders`                     | Create                                                                                                                                 |
| PUT    | `/users/{id}`, `/products/{id}`, `/customers/{id}`, `/orders/{id}` | Full replace                                                                                                                           |
| PATCH  | `/users/{id}`, `/products/{id}`, `/customers/{id}`, `/orders/{id}` | Partial update                                                                                                                         |
| DELETE | `/users/{id}`, `/products/{id}`, `/customers/{id}`, `/orders/{id}` | Delete                                                                                                                                 |

Seed data at startup: 50 users, 50 products, 60 customers, 100 orders — deterministic and reproducible
across restarts. Orders reference an existing `customerId` and `items[].productId`; customers may
optionally link to a user account via `userId`.

## Response shapes

Every response (success or error) carries an `X-Request-ID` header. Every error response uses the shared
envelope:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "...",
    "details": {},
    "requestId": "..."
  }
}
```

Every list response uses the shared pagination envelope:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

## Spec documentation

- [specs/001-foundation-platform/](specs/001-foundation-platform/) — spec, plan, data model, OpenAPI
  contract, and quickstart for the foundation layer.
- [specs/002-core-crud-resources/](specs/002-core-crud-resources/) — spec, plan, data model, OpenAPI
  contract, and quickstart for the CRUD resources.

## License

Released under the [MIT License](LICENSE) by [@io-anurag](https://github.com/io-anurag).
