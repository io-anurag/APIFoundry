# APIFoundry Roadmap

This roadmap decomposes the full feature surface defined in [`.claude/CLAUDE.md`](.claude/CLAUDE.md) and
the project constitution ([`.specify/memory/constitution.md`](.specify/memory/constitution.md)) into a
sequence of Spec Kit specs. Each spec below is sized to be **independently specifiable, plannable, and
implementable** through the existing workflow:

```text
/speckit-specify → /speckit-clarify → /speckit-plan → /speckit-tasks → /speckit-analyze → /speckit-implement
```

No application code exists yet (repo currently holds only `.claude/`, `.specify/`, `.qodo/` scaffolding), so
Spec 001 must land before anything else. After that, specs are ordered by dependency, with parallelizable
groups called out explicitly.

## Principles used to draw the boundaries

- **Dependency-first ordering**: a spec never assumes infrastructure (config, error envelope, request-id,
  data store patterns) that a later spec would introduce.
- **Independently testable slices**: every spec ends in something you can `npm start` and hit with `curl`
  or a test suite — never a partial, unusable state.
- **One concern per spec**: auth mechanisms, CRUD data, and chaos/testing-utility endpoints are split apart
  even though CLAUDE.md lists them together, because they have different reviewers' mental models and can
  be built/tested in parallel once the foundation exists.
- **Constitution compliance is a cross-cutting acceptance criterion**, not its own spec: every spec's
  acceptance criteria must include the error envelope, pagination envelope, `X-Request-ID`, determinism,
  secret hygiene, and bounded-resource rules from the constitution.

## Spec sequence

| # | Spec | CLAUDE.md refs | Depends on | Parallelizable with |
|---|------|-----------------|------------|----------------------|
| 001 | Foundation, Config & Health | #1, #29, #30, project structure, `.env` | — | — |
| 002 | Core CRUD Resources (users, products, orders, customers) | #2, #3, #4, #5 | 001 | — |
| 003 | Read-Only Catalog & Nested Resources (categories, posts, comments, reviews, payments) + Search | #2, #12, #13 | 001, 002 | 004, 006, 007 |
| 004 | Status Code Playground | #6 | 001 | 002, 003, 005, 006, 007 |
| 005 | JWT Authentication, Roles & Scopes | #7, #8, #9 | 001 | 003, 004, 006 |
| 006 | API Key & Basic Auth | #10, #11 | 001 | 003, 004, 005 |
| 007 | HTTP Testing Utilities (delay, payload, content types, headers, cookies) | #14, #15, #16, #17, #18, #19 | 001 | 002–006 |
| 008 | Resilience Simulation (rate limiting, flaky/random, idempotency, caching/ETags) | #20, #21, #22, #23 | 001, 003 (payments) | 007, 009 |
| 009 | Files API | #24 | 001 | 002–008 |
| 010 | Error Simulation & Generic Scenario Endpoint | #25, #26 | 005, 006, 007, 008 | — |
| 011 | Admin & Reset | #27 | 002, 003, 005, 006, 008 | — |
| 012 | OpenAPI, Swagger UI & Route Discovery | #28, `/api/v1/info`, `/api/v1/routes` | all preceding | — |
| 013 | Automated Test Hardening, k6 Scenarios & README | Testing expectations, k6/workflow sections | all preceding | — |

Rows without a listed dependency in a column can be built in any order relative to each other, so long as
their own "Depends on" column is satisfied.

## Spec details

### Spec 001 — Foundation, Config & Health
**Slug**: `001-foundation-platform`
**Goal**: A running, empty-but-correct Express+TypeScript server that every later spec builds on.
- Project structure exactly as specified in CLAUDE.md (`src/app.ts`, `server.ts`, `config/`, `middleware/`,
  `routes/`, `controllers/`, `services/`, `models/`, `data/`, `auth/`, `utils/`, `openapi/`, `tests/`).
- `.env.example`, env parsing/validation in `config/`.
- Cross-cutting middleware: request-id, structured request logging (never logging secrets), the shared
  error envelope and pagination envelope shapes, a central error-handling middleware that guarantees no
  unhandled throw ever crashes the process.
- Configurable CORS via `CORS_ORIGIN`.
- `GET /health`, `/health/live`, `/health/ready`, `/version`, `GET /api/v1/info`.
- Empty OpenAPI document + Swagger UI wiring at `/docs` (skeleton only — populated incrementally by later
  specs; hardened in Spec 012).
- Test harness (Jest/Vitest + Supertest) configured and running (even if only covering health endpoints).

### Spec 002 — Core CRUD Resources
**Slug**: `002-core-crud-resources`
**Goal**: Full CRUD for the four primary resources, with realistic seed data and complete parameter/validation edge-case coverage.
- Resources: `users`, `products`, `orders`, `customers` — `GET` (list + one), `POST`, `PUT`, `PATCH`,
  `DELETE` for each.
- Deterministic seed data: ≥50 users, ≥50 products, ≥100 orders (customers seeded to match).
- Path parameter edge cases per ID: valid, missing, malformed, negative, zero, huge, empty — across
  int/UUID/string param types as applicable per resource.
- Query parameters: pagination (`page`/`limit` incl. invalid values), sorting (`sort=field`/`-field`),
  filtering (single + combined), returning the standard pagination envelope.
- Request validation on POST/PUT/PATCH: missing required fields, wrong types, invalid email/UUID/enum,
  string/number bounds, null, empty string/array, nested objects/arrays, unexpected fields → `400`/`422`.

### Spec 003 — Read-Only Catalog & Nested Resources + Search
**Slug**: `003-catalog-nested-search`
**Goal**: The remaining read-oriented resources, their relationships to the Spec 002 resources, and cross-resource search.
- Read-oriented resources: `categories` (≥20), `posts` (≥100), `comments` (≥200), `reviews`, `payments`.
- Nested routes: `users/:id/orders`, `users/:id/posts` (GET + POST), `posts/:id/comments` (GET + POST),
  `products/:id/reviews`, `orders/:id/products`, `products/:id/category`.
- Path parameter type diversity called for by CLAUDE.md but not yet exercised: UUID, slug, date, enum.
- `GET /api/v1/search?q=` across resources, covering empty/missing/no-result/special-char/long-query/
  case-sensitivity.

### Spec 004 — Status Code Playground
**Slug**: `004-status-code-playground`
**Goal**: Deterministic, self-contained endpoints for every documented status code.
- `GET /api/v1/status/{code}` for 200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405, 406, 408, 409,
  410, 415, 422, 429, 500, 501, 502, 503, 504 — correct HTTP semantics and a useful body per code.

### Spec 005 — JWT Authentication, Roles & Scopes
**Slug**: `005-jwt-auth-roles-scopes`
**Goal**: The primary auth mechanism testing tools will exercise, including all token failure modes.
- `POST /auth/login`, `/auth/logout`, `/auth/refresh`, `GET /auth/me`, `POST /auth/token`,
  `GET /auth/token-info`.
- Configurable secret/issuer/audience/expiry via env; convenience issuers for valid/expired/invalid/revoked
  tokens; coverage for malformed token, wrong signature, wrong issuer/audience.
- `GET /api/v1/protected` demonstrating `401` (auth failure) vs `403` (authz failure).
- Roles (`user`/`admin`/`manager`/`readonly`) with `GET /api/v1/role/{role}` demo endpoints.
- Scopes (`users:read`, `users:write`, `products:read`, `products:write`, `orders:read`, `orders:write`,
  `admin`) with `INSUFFICIENT_SCOPE` 403 responses.

### Spec 006 — API Key & Basic Auth
**Slug**: `006-api-key-basic-auth`
**Goal**: The two secondary auth mechanisms, independent of the JWT flow.
- `X-API-Key` header support: `GET /api-key/protected`, `POST /auth/api-key`, `POST /auth/api-key/revoke`;
  valid/invalid/missing/expired/revoked cases.
- HTTP Basic Auth: `GET /auth-test/basic`; valid/invalid/missing/malformed credentials.

### Spec 007 — HTTP Testing Utilities
**Slug**: `007-http-testing-utilities`
**Goal**: The low-level HTTP-mechanics endpoints used for timeout, payload, and header/cookie testing.
- `GET /delay/{ms}` and `GET /delay?ms=`, bounded by `MAX_DELAY_MS`.
- `GET /payload/{small|medium|large}` and `GET /payload?size=`, bounded by `MAX_PAYLOAD_SIZE`.
- `POST /payload` echo (`{ received, contentLength }`) covering small/large/nested/array/invalid-JSON/
  oversized bodies.
- `GET /content/{json|text|html|xml}` plus request `Content-Type` validation.
- `GET /headers` echoing only safe incoming headers.
- `GET/POST/DELETE /cookies`.

### Spec 008 — Resilience Simulation
**Slug**: `008-resilience-simulation`
**Goal**: Endpoints that simulate unreliable backends in a reproducible way.
- `GET /rate-limit` with configurable threshold, `429` + `Retry-After` past it.
- `GET /flaky?failureRate=` with configurable failure status types (500/502/503/504), disableable,
  reproducible for automated tests (seedable RNG).
- `POST /payments` honoring `Idempotency-Key`, including conflict scenarios (reuses the `payments` model
  from Spec 003).
- `GET /cache/resource` supporting `ETag`/`If-None-Match`/`Last-Modified`/`If-Modified-Since`/
  `Cache-Control`, returning `304` when appropriate.

### Spec 009 — Files API
**Slug**: `009-files-api`
**Goal**: Bounded file upload/download/delete, isolated from every other concern.
- `GET/POST/DELETE /files[/:id]`, multipart upload if practical, bounded resource use (no unbounded disk/
  memory growth).

### Spec 010 — Error Simulation & Generic Scenario Endpoint
**Slug**: `010-error-simulation-scenario-endpoint`
**Goal**: The capstone k6-facing endpoint that composes behaviors introduced in Specs 005–008.
- `GET /errors/{validation|not-found|conflict|unauthorized|forbidden|rate-limit|server-error|
  service-unavailable|timeout}` — deterministic, dedicated endpoints.
- `GET /api/v1/test?scenario=...` supporting success, validation-error, unauthorized, forbidden, not-found,
  conflict, rate-limit, server-error, service-unavailable, timeout, delayed, large-response, with optional
  `status`/`delay`/`failureRate` params.

### Spec 011 — Admin & Reset
**Slug**: `011-admin-reset`
**Goal**: A single, admin-token-gated way to return every stateful subsystem to its seed state.
- `POST /admin/reset` (seed data), `POST /admin/auth/reset` (tokens, revoked tokens, API keys).
- Also resets rate-limit state and idempotency state.
- Gated by configurable `ADMIN_TOKEN`.
- Deliberately last among functional specs: it must know about every piece of mutable state introduced by
  Specs 002, 003, 005, 006, and 008.

### Spec 012 — OpenAPI, Swagger UI & Route Discovery
**Slug**: `012-openapi-docs-route-discovery`
**Goal**: Full spec/implementation parity, verified rather than assumed.
- `/openapi.json`, `/openapi.yaml`, Swagger UI at `/docs` documenting every endpoint from Specs 001–011
  (params, body, responses, auth, examples) under `components.schemas` / `components.securitySchemes`.
- `GET /api/v1/routes` route-discovery endpoint enumerating method/path/description/auth for every route.
- Acceptance criterion: a diff between the OpenAPI document and the actual route table is empty.
- Note: each prior spec should add its own OpenAPI fragment as it ships (per the constitution's spec-parity
  gate); this spec is the reconciliation and hardening pass, not the first time documentation appears.

### Spec 013 — Automated Test Hardening, k6 Scenarios & README
**Slug**: `013-test-hardening-k6-readme`
**Goal**: Confidence that the whole surface works together, and that external users/tools can find it.
- Comprehensive Jest/Vitest + Supertest coverage across CRUD, all HTTP methods, path/query edge cases,
  validation, all three auth mechanisms (incl. expiry/revocation/scopes/roles), pagination/filtering/
  sorting, status codes, delays, rate limiting, ETags, idempotency, nested resources, error handling.
- k6 scripts implementing the chained workflows from CLAUDE.md (e.g. login → `/auth/me` → list users → get
  user → update user → create order → get order → delete user) and the smoke/load/stress/spike/soak/
  endurance/latency/timeout/error-rate/auth/CRUD/chained-workflow/concurrent-user scenario categories.
- Comprehensive README (overview, architecture, install/config/run, full endpoint catalog, curl examples).
- Final quality gate: install → start → full test suite green → manual spot-check of `/docs`,
  `/openapi.json`, `/openapi.yaml`, `/api/v1/routes` against the live server.

## Suggested execution order (single-threaded)

```text
001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013
```

## Suggested execution order (if parallelizing across specs once 001 lands)

```text
001
 ├─→ 002 ─→ 003 ─┐
 ├─→ 004         │
 ├─→ 005         ├─→ 010 ─→ 011 ─→ 012 ─→ 013
 ├─→ 006         │
 ├─→ 007         │
 └─→ 008 ────────┘ (needs 003's payments model)
 └─→ 009
```

## Next step

Run `/speckit-specify` for **Spec 001 — Foundation, Config & Health** to generate its
`specs/001-foundation-platform/spec.md`, then proceed through `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement` before starting Spec 002.
