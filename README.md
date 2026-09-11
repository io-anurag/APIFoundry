# APIFoundry

[![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.x-6BA539?logo=openapiinitiative&logoColor=white)](https://www.openapis.org/)
[![Vitest](https://img.shields.io/badge/Vitest-testing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-enabled-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/io-anurag/APIFoundry/.github/workflows/ci.yml/badge.svg)](https://github.com/io-anurag/APIFoundry/.github/workflows/ci.yml)
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
- **003 — Read-Only Catalog & Nested Resources + Search**: read-only `categories`, `posts`, `comments`,
  `reviews`, `payments`, six nested/derived routes connecting them to the Spec 002 resources, and
  cross-resource `GET /api/v1/search`.
- **004 — Status Code Playground**: `GET /api/v1/status/{code}` deterministically reproduces the exact
  status, headers, and body for every documented HTTP status code.
- **005 — JWT Authentication, Roles & Scopes**: login/logout/refresh/me session lifecycle, test-only
  convenience token issuance (`valid`/`expired`/`invalid`/`revoked`) and inspection, and dedicated demo
  endpoints proving 401-vs-403, per-role, and per-scope enforcement.

API key/Basic auth, HTTP testing utilities, resilience simulation, and the rest of the surface are
tracked in [ROADMAP.md](ROADMAP.md).

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

### Catalog, nested resources & search (Spec 003)

| Method   | Path                          | Description                                                                                        |
| -------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| GET      | `/categories`                 | Paginated list                                                                                     |
| GET      | `/categories/{slug}`          | Get one by slug                                                                                    |
| GET      | `/posts`                      | Paginated list                                                                                     |
| GET      | `/posts/{id}`                 | Get one by UUID                                                                                    |
| GET      | `/comments`                   | Paginated list                                                                                     |
| GET      | `/comments/{id}`              | Get one by id                                                                                      |
| GET      | `/reviews`                    | Paginated list                                                                                     |
| GET      | `/reviews/{id}`               | Get one by id                                                                                      |
| GET      | `/reviews/by-rating/{rating}` | Reviews with a given rating (1-5)                                                                  |
| GET      | `/payments`                   | Paginated list                                                                                     |
| GET      | `/payments/{id}`              | Get one by UUID                                                                                    |
| GET      | `/payments/by-date/{date}`    | Payments processed on a given calendar date                                                        |
| GET      | `/users/{id}/orders`          | Orders placed by customers linked to that user                                                     |
| GET/POST | `/users/{id}/posts`           | List / author a post as that user                                                                  |
| GET/POST | `/posts/{id}/comments`        | List / add a comment on that post                                                                  |
| GET      | `/products/{id}/reviews`      | Reviews for that product                                                                           |
| GET      | `/products/{id}/category`     | The Category record matching that product's `category`                                             |
| GET      | `/orders/{id}/products`       | Distinct products referenced by that order's line items                                            |
| GET      | `/search?q=`                  | Cross-resource free-text search (users, customers, products, categories, posts, comments, reviews) |

These five top-level resources are read-only (`POST`/`PUT`/`PATCH`/`DELETE` return `405`) except the two
nested `POST` routes above. Seed data: ≥20 categories, ≥100 posts, ≥200 comments, ≥100 reviews, one
payment per seeded order.

### Status Code Playground (Spec 004)

| Method | Path             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/status/{code}` | Deterministically demonstrates one of 24 documented HTTP status codes (200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405, 406, 408, 409, 410, 415, 422, 429, 500, 501, 502, 503, 504) — correct status line, semantic headers (`Location` on redirects, `Allow` on 405, `Retry-After` on 429), and body shape per code. A `code` value that is malformed, outside the 100-599 range, or well-formed but undocumented always returns `400`. |

### JWT Authentication, Roles & Scopes (Spec 005)

`/auth/*` endpoints are top-level (not under `{API_PREFIX}`), matching CLAUDE.md's own path spelling.

| Method | Path                         | Auth                                   | Description                                                                                                                        |
| ------ | ---------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/login`                | none                                   | Log in with a demo account; returns an access/refresh token pair                                                                   |
| POST   | `/auth/logout`               | Bearer (access)                        | Revokes the caller's session; idempotent — a second logout with the same token still returns `200`                                 |
| POST   | `/auth/refresh`              | none (refresh token is the credential) | Exchanges a valid, current refresh token for a new access/refresh pair (single-use rotation)                                       |
| GET    | `/auth/me`                   | Bearer (access)                        | Returns the authenticated identity's `sub`/`role`/`scopes`                                                                         |
| POST   | `/auth/token`                | none (test convenience)                | Issues a token directly for a chosen `role`/`scopes`/`kind` (`valid`, `expired`, `invalid`, `revoked`), without logging in         |
| GET    | `/auth/token-info`           | Bearer (any token)                     | Decodes and diagnoses any token's validity state — including expired/invalid/revoked ones; never gated by the enforcing auth check |
| GET    | `{API_PREFIX}/protected`     | Bearer, role `admin`                   | Demonstrates `401` (no/invalid token) vs `403` (valid token, wrong role) vs `200`                                                  |
| GET    | `{API_PREFIX}/role/{role}`   | Bearer, matching role                  | `200` only when the caller's token role matches `{role}`; `400` if `{role}` isn't one of the four documented roles                 |
| GET    | `{API_PREFIX}/scope/{scope}` | Bearer, matching scope (or `admin`)    | `200` only when the caller's token carries `{scope}` (or the `admin` scope); `403`/`INSUFFICIENT_SCOPE` otherwise                  |

Roles: `user`, `admin`, `manager`, `readonly`. Scopes: `users:read`, `users:write`, `products:read`,
`products:write`, `orders:read`, `orders:write`, `admin` (the `admin` scope satisfies every scope check).

Demo login accounts (feature-owned, independent of the `users` CRUD resource — see
[specs/005-jwt-auth-roles-scopes/data-model.md](specs/005-jwt-auth-roles-scopes/data-model.md)):

| Username        | Password          | Role       |
| --------------- | ----------------- | ---------- |
| `demo.user`     | `user-pass-1`     | `user`     |
| `demo.admin`    | `admin-pass-1`    | `admin`    |
| `demo.manager`  | `manager-pass-1`  | `manager`  |
| `demo.readonly` | `readonly-pass-1` | `readonly` |

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
- [specs/003-catalog-nested-search/](specs/003-catalog-nested-search/) — spec, plan, data model, OpenAPI
  contract, and quickstart for the catalog, nested resources, and search.
- [specs/004-status-code-playground/](specs/004-status-code-playground/) — spec, plan, data model,
  OpenAPI contract, and quickstart for the status code playground.
- [specs/005-jwt-auth-roles-scopes/](specs/005-jwt-auth-roles-scopes/) — spec, plan, data model,
  OpenAPI contract, and quickstart for JWT auth, roles, and scopes.

## License

Released under the [MIT License](LICENSE) by [@io-anurag](https://github.com/io-anurag).
