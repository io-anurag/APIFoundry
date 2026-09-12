# Feature Specification: OpenAPI, Swagger UI & Route Discovery

**Feature Branch**: `012-openapi-docs-route-discovery`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 012 — OpenAPI, Swagger UI & Route Discovery"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and Validate the Full API Surface via a Single Accurate Document (Priority: P1)

An automated testing tool (contract test generator, API fuzzer, k6 script scaffolder) points at this
mock server for the first time and needs one authoritative, machine-readable document describing every
endpoint implemented across the project — paths, parameters, request/response schemas, status codes,
and authentication requirements — so it can generate its test matrix without a human reading source code.

**Why this priority**: This is the entire reason the project exists as "backed by an accurate OpenAPI
3.x spec so testing tools can discover it automatically" (CLAUDE.md, "What this project is") and is the
constitution's explicit Quality Gate: the document and the live implementation must match exactly, with
any mismatch treated as a defect.

**Independent Test**: Can be fully tested by fetching `GET /openapi.json`, enumerating every path/method
pair it declares, then calling each corresponding live endpoint and confirming the response shape,
status codes, and auth requirements match what the document says — with zero endpoints present in one
but not the other.

**Acceptance Scenarios**:

1. **Given** the server is running with every prior spec's endpoints implemented, **When** a client
   requests `GET /openapi.json`, **Then** the system returns a valid OpenAPI 3.x document listing every
   implemented route with its parameters, request body schema (where applicable), and response schemas
   per documented status code.
2. **Given** the same document, **When** its declared paths/methods are compared against the server's
   actual route table, **Then** there is no path/method the document declares that the server doesn't
   implement, and no implemented route the document omits.
3. **Given** an endpoint that requires authentication, **When** its operation entry is inspected in the
   document, **Then** it references the correct security scheme(s) (JWT bearer, API key, Basic, or admin
   token) exactly matching what the live endpoint actually enforces.
4. **Given** the document is run through a standard OpenAPI 3.x validation/spec-analysis tool, **Then**
   it passes as structurally valid with no unsupported-construct warnings.

---

### User Story 2 - Explore and Exercise Endpoints Interactively Without Writing Code (Priority: P2)

A developer or manual tester new to the mock server wants to browse every available endpoint, read its
expected inputs/outputs, and try a real request against the running server directly from a browser,
without first writing a client or reading the source.

**Why this priority**: CLAUDE.md explicitly requires "Swagger UI (`/docs`)" as part of the tech stack and
feature surface; it is the human-facing complement to User Story 1's machine-facing document and is how
most people will first evaluate what the mock server can do.

**Independent Test**: Can be fully tested by opening `GET /docs` in a browser, selecting any documented
operation, executing it via the UI's "try it out" action, and confirming the live response received
matches both what the UI displays and what a direct `curl` call to the same endpoint returns.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** a user navigates to `GET /docs`, **Then** they see an
   interactive UI listing every documented endpoint grouped in a navigable way, sourced from the same
   document as `GET /openapi.json`.
2. **Given** an endpoint requiring authentication, **When** a user supplies valid credentials through the
   UI's authorization mechanism, **Then** subsequent "try it out" calls to protected endpoints succeed
   exactly as they would via a direct authenticated request.
3. **Given** any documented endpoint, **When** a user executes it via "try it out" with example or
   custom input, **Then** the UI displays the real HTTP status code and response body returned by the
   live server, not a mocked or cached example.

---

### User Story 3 - Enumerate Every Route Programmatically for Test-Coverage Bookkeeping (Priority: P3)

An automated test suite or coverage-tracking script needs a lightweight, structured list of every route
the server exposes — method, path, a short description, and its auth requirement — without parsing a
full OpenAPI document, so it can check off which routes its own test matrix has already covered.

**Why this priority**: CLAUDE.md explicitly lists `/api/v1/routes` ("route discovery — method, path,
description, auth requirement per route") as its own meta endpoint distinct from the OpenAPI document;
it is lower priority than Stories 1-2 because it re-derives from the same underlying route information
those already expose, but it serves a narrower, script-friendly consumption pattern.

**Independent Test**: Can be fully tested by calling `GET /api/v1/routes` and confirming its entry count
and field values exactly match the routes and auth requirements declared in `GET /openapi.json`.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** a client calls `GET /api/v1/routes`, **Then** the system
   returns a list where every entry has a method, a path, a short description, and an auth requirement
   (none, or the specific scheme/role/scope needed).
2. **Given** the same server state, **When** the entries returned by `GET /api/v1/routes` are compared
   against the operations declared in `GET /openapi.json`, **Then** the two lists match exactly in route
   count and per-route auth requirement.

---

### Edge Cases

- What happens when a route requires more than one alternative valid auth scheme (e.g. an endpoint reachable
  by either a JWT or an API key)? The document and the route-discovery list MUST both represent every
  valid alternative for that route, not just one.
- What happens when two different HTTP methods share the same path but have different auth requirements
  (e.g. `GET /users/:id` open, `DELETE /users/:id` admin-gated)? Each method on that path MUST be
  documented and listed as an independent entry with its own accurate auth requirement.
- What happens when a resource field's runtime value can take more than one shape across different
  records (e.g. a cross-resource search result's `id`, numeric for some resource types and a string for
  others)? The document MUST describe it as a single concrete type consistent with what the
  implementation actually returns, never as a schema union.
- What happens when `GET /openapi.json` and `GET /openapi.yaml` are compared? They MUST describe an
  identical API surface — same paths, schemas, and security requirements — differing only in
  serialization format.
- What happens when an unauthenticated client requests `/openapi.json`, `/openapi.yaml`, `/docs`, or
  `/api/v1/routes` themselves? Each of these four discovery endpoints MUST be reachable without any
  credential, consistent with the project's other meta endpoints (`/health`, `/version`).
- What happens if a future code change adds or removes a route without a corresponding documentation
  update? That state MUST be treated as a defect per the constitution's spec-parity quality gate — this
  feature's own acceptance criteria include a check that closes that gap for every endpoint that exists at
  the time this feature ships.

## Requirements *(mandatory)*

### Functional Requirements

**Document generation & delivery**

- **FR-001**: System MUST expose `GET /openapi.json` returning a complete, valid OpenAPI 3.x document
  describing every endpoint implemented by every preceding spec (001-011): meta/health, CRUD and
  read-oriented resources, path/query parameter variants, validation, status-code playground, JWT/API-key/
  Basic/admin-token auth, roles/scopes, nested resources, search, delay, payload size/echo, content types,
  headers, cookies, rate limiting, flaky/random, idempotency, caching, files, error simulation, the generic
  scenario endpoint, and admin/reset.
- **FR-002**: System MUST expose `GET /openapi.yaml` describing the identical API surface as
  `GET /openapi.json` in YAML serialization — same paths, schemas, and security requirements, format only
  differs.
- **FR-003**: System MUST expose an interactive Swagger UI at `GET /docs` that renders the same underlying
  document as `GET /openapi.json`/`GET /openapi.yaml` and allows executing real requests against the
  running server from the browser ("try it out"), including supplying credentials for protected
  operations.
- **FR-004**: `GET /openapi.json`, `GET /openapi.yaml`, `GET /docs`, and `GET /api/v1/routes` MUST each be
  reachable without authentication.

**Per-operation documentation completeness**

- **FR-005**: Every documented operation MUST include, at minimum: a summary/description, every path/query/
  header parameter it accepts (with type and required/optional), a request body schema where the operation
  accepts one, a response schema for every status code it can return, its security requirement(s) (or
  explicitly none), and at least one example value.
- **FR-006**: System MUST document every security scheme actually enforced anywhere in the implementation —
  JWT bearer, `X-API-Key` header, HTTP Basic, and `X-Admin-Token` header — under
  `components.securitySchemes`, and each operation MUST reference exactly the scheme(s) it actually
  enforces, including operations reachable by more than one valid alternative scheme.
- **FR-007**: Roles and scopes enforced by an operation (per Spec 005) MUST be discoverable from
  that operation's documentation — via its description/summary text and (for `GET /api/v1/routes`)
  the route registry's `detail` field — not only from the underlying auth scheme name. (An
  `http`-type security scheme's `security` requirement array cannot itself carry role/scope values;
  that syntax is only meaningful for `oauth2`/`openIdConnect` schemes, so this project's `bearerAuth`
  scheme keeps an empty array on every operation regardless of any role/scope it enforces.)

**Schema authoring constraints**

- **FR-008**: The document MUST NOT use the `allOf`, `oneOf`, or `anyOf` schema combinators anywhere.
  Paginated list responses MUST be represented as a single flat object with a `data` array of the specific
  resource type and a `pagination` field referencing a plain metadata schema — never composed via `allOf`.
  A field whose runtime value can take more than one type MUST be documented as one concrete type that the
  implementation is made to consistently match, never as a `oneOf`/`anyOf` union.

**Route discovery**

- **FR-009**: System MUST expose `GET /api/v1/routes` returning a list covering every implemented route,
  each entry containing at minimum: HTTP method, path, a short human-readable description, and its auth
  requirement (none, or the specific scheme plus any required role/scope).
- **FR-010**: The route count and per-route auth requirement returned by `GET /api/v1/routes` MUST exactly
  match what `GET /openapi.json`/`GET /openapi.yaml` declare for the same routes.

**Consistency & robustness**

- **FR-011**: The set of paths/methods declared by `GET /openapi.json` (and `/openapi.yaml`, and rendered by
  `/docs`) MUST exactly match the server's actual implemented routes — no documented route that doesn't
  exist, and no implemented route left undocumented.
- **FR-012**: None of `GET /openapi.json`, `GET /openapi.yaml`, `GET /docs`, or `GET /api/v1/routes` MUST
  ever throw an unhandled exception or crash the process, regardless of request headers or query string
  content supplied to them.

### Key Entities

- **OpenAPI Document**: The canonical, versioned description of the entire API surface (paths, parameters,
  request/response schemas, security schemes) served as JSON and YAML and rendered by Swagger UI; the
  single source of truth all three discovery surfaces must agree with.
- **Route Registry Entry**: One row returned by `GET /api/v1/routes` — method, path, description, and auth
  requirement — derived from the same underlying route information as the OpenAPI Document.
- **Security Scheme Descriptor**: A named authentication mechanism (JWT bearer, API key, Basic, admin
  token) declared once under `components.securitySchemes` and referenced by every operation that enforces
  it, including operations that accept more than one alternative scheme.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Comparing the OpenAPI document's declared paths/methods against the server's actual route
  table yields zero discrepancies in either direction (nothing documented-but-missing, nothing
  implemented-but-undocumented).
- **SC-002**: 100% of endpoints that enforce authentication have their exact scheme(s) — including any
  role/scope requirement — correctly represented in the document and in `/api/v1/routes`.
- **SC-003**: A person unfamiliar with the codebase can find and successfully execute any implemented
  endpoint from `/docs` alone, without reading source code.
- **SC-004**: An automated tool can enumerate 100% of implemented routes via `GET /api/v1/routes` alone,
  without needing to also parse the full OpenAPI document.
- **SC-005**: The OpenAPI document passes structural validation with a standard OpenAPI 3.x validator/
  spec-analysis tool with zero unsupported-construct warnings.

## Assumptions

- **Scope is documentation and discovery of the API surface produced by Specs 001-011**: this feature adds
  no new business endpoints of its own beyond the three discovery surfaces (`/openapi.json`,
  `/openapi.yaml`, `/docs`) and the route-registry endpoint (`/api/v1/routes`); it is a reconciliation and
  hardening pass over already-implemented behavior, not new product functionality.
- **OpenAPI 3.x is the only documented format**, per CLAUDE.md; no GraphQL schema or other API description
  format is in scope.
- **No new environment variables**: this feature introduces no configuration beyond what earlier specs
  already define.
- **Schemas avoid `allOf`/`oneOf`/`anyOf` combinators throughout**, matching the project's established
  documentation convention for representing paginated envelopes and polymorphic fields as flat, concrete
  types rather than composed/union schemas.
- **All four discovery endpoints are publicly reachable without credentials**, consistent with the
  project's other meta/health endpoints, since gating documentation itself behind auth would defeat its
  purpose for external testing tools evaluating the server for the first time.
