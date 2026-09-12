---

description: "Task list template for feature implementation"
---

# Tasks: OpenAPI, Swagger UI & Route Discovery

**Input**: Design documents from `/specs/012-openapi-docs-route-discovery/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/route-discovery.openapi.yaml](contracts/route-discovery.openapi.yaml),
[quickstart.md](quickstart.md)

**Tests**: Included. The constitution's Quality Gates ("new or changed endpoints MUST include
corresponding automated test coverage... before being considered done") make test coverage
mandatory for this project; this feature's entire purpose is turning a manual spec/implementation
spot-check into an enforced automated gate, so test tasks are not optional here.

**Organization**: Tasks are grouped by user story (from spec.md). A pre-plan audit (recorded in
research.md) found that `GET /openapi.json`, `GET /openapi.yaml`, and `GET /docs` already exist and
already serve a document covering every operation from Specs 001-011 with zero schema combinators —
so most of this feature's work is (a) closing two real documentation gaps a `/speckit-analyze` pass
found (46 operations silently omit an explicit `security` field, relying on omission rather than
stating `security: []`; and `GET /auth/token-info` states an incorrect `security` requirement it
does not actually enforce), (b) adding the automated parity test the roadmap calls for, and (c)
adding the one missing endpoint, `GET /api/v1/routes` (User Story 3). Because User Story 1's parity test compares
the *live* route set against `openapi.yaml` generically (not a hardcoded count), it stays valid and
green through every later phase without modification, automatically covering User Story 3's new
route the moment it lands.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-011 layout. No new top-level directories. `src/app.ts` and root `openapi.yaml` are each touched
once (User Story 3's route mount and doc merge).

---

## Phase 1: Setup

**Purpose**: Project initialization and new dependencies.

No tasks. This feature adds no new npm dependency — the route catalog is a plain TypeScript
constant array (same pattern as `src/data/testScenarios.catalog.ts`), and the live-route
introspection helper uses only Express's own already-installed internals. Proceed directly to
Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Create `tests/helpers/listAppRoutes.ts` (research.md Decision 1; verified against the
      installed `express@4.21` source: `.all()`-registered catch-all layers set
      `route.methods._all = true` distinctly from real verbs, and a router mounted with no path
      argument — e.g. `app.use(healthRouter)` — gets `layer.regexp.fast_slash === true`, while
      `app.use(config.apiPrefix, apiRouter)` does not): `import type { Express } from "express";
      import { config } from "../../src/config";` export `interface LiveRoute { method: string;
      path: string; }` — a `toBracketPath` helper: `function toBracketPath(expressPath: string):
      string { return expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}"); }` — a recursive walker:
      `// eslint-disable-next-line @typescript-eslint/no-explicit-any
      function walk(stack: any[], prefix: string, routes: LiveRoute[]): void { for (const layer of
      stack) { if (layer.route) { const path = toBracketPath(prefix + layer.route.path); for (const
      method of Object.keys(layer.route.methods)) { if (method === "_all") continue;
      routes.push({ method: method.toUpperCase(), path }); } } else if (layer.name === "router" &&
      layer.handle?.stack) { const nestedPrefix = layer.regexp?.fast_slash ? prefix : prefix +
      config.apiPrefix; walk(layer.handle.stack, nestedPrefix, routes); } } }` — and the exported
      entry point: `export function listAppRoutes(app: Express): LiveRoute[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const root = (app as any)._router; const routes: LiveRoute[] = []; walk(root.stack, "",
      routes); const unique = new Map<string, LiveRoute>(); for (const r of routes)
      unique.set(\`${r.method} ${r.path}\`, r); return [...unique.values()].sort((a, b) =>
      a.path.localeCompare(b.path) || a.method.localeCompare(b.method)); }`. Before relying on this
      in T005, temporarily log `listAppRoutes(app)` against the running `app` (e.g. from a scratch
      script or a `console.log` in a throwaway test) and confirm the returned list's length and a
      handful of known paths (`GET /health`, `GET /api/v1/users/{id}`, `POST /admin/reset`) look
      correct before deleting the scratch check — Express's internal `Layer`/`Route` shapes are
      intentionally undocumented, so this empirical check is the real verification, not the code
      above by itself.

**Checkpoint**: Foundation ready — the live-route ground truth is available for both User Story 1's
and User Story 3's parity checks.

---

## Phase 3: User Story 1 - Discover and Validate the Full API Surface via a Single Accurate Document (Priority: P1) 🎯 MVP

**Goal**: `GET /openapi.json`/`GET /openapi.yaml` (already implemented, Spec 001) declare exactly
the live server's route surface — no more, no less — every operation states its security
requirement explicitly, and the document contains zero `allOf`/`oneOf`/`anyOf` combinators, all
enforced by automated tests rather than a manual spot-check.

**Independent Test**: Run `npm test -- tests/routeParity.test.ts tests/openapiSchema.test.ts
tests/openapiDocs.test.ts` — all pass, proving the document's declared paths/methods exactly match
the live Express app, every operation has an explicit and accurate security requirement, every
`$ref` resolves, and no combinator appears anywhere. See quickstart.md Scenario 1.

### Implementation for User Story 1

- [ ] T002 [US1] Edit root `openapi.yaml`, two changes: **(1)** add `security: []` explicitly to
      every operation below that currently has no `security` key at its operation level (confirmed
      by direct inspection — each one is served by a router with zero auth middleware attached, so
      this makes the already-true "no authentication required" state explicit rather than implied by
      omission; FR-005, FR-006); **(2)** correct `GET /auth/token-info`'s existing `security` value
      from `[{ bearerAuth: [] }]` to `[]` — `src/routes/auth.routes.ts` deliberately does **not**
      gate this route with the `authenticate` middleware (its own comment: "its purpose is to
      diagnose tokens `authenticate` would otherwise reject"), so the currently-documented
      `bearerAuth` requirement misrepresents this endpoint's real, auth-optional behavior. This is a
      pre-existing FR-006 defect (found during `/speckit-analyze`) that this feature must close, not
      a new requirement it introduces. Both changes are documentation-only edits — neither changes
      any operation's runtime behavior. The 46 operations gaining a newly-added `security: []`:
      `GET /api/v1/users`, `POST /api/v1/users`, `GET /api/v1/users/{id}`, `PUT /api/v1/users/{id}`,
      `PATCH /api/v1/users/{id}`, `DELETE /api/v1/users/{id}`,
      `GET /api/v1/products`, `POST /api/v1/products`, `GET /api/v1/products/{id}`,
      `PUT /api/v1/products/{id}`, `PATCH /api/v1/products/{id}`, `DELETE /api/v1/products/{id}`,
      `GET /api/v1/customers`, `POST /api/v1/customers`, `GET /api/v1/customers/{id}`,
      `PUT /api/v1/customers/{id}`, `PATCH /api/v1/customers/{id}`, `DELETE /api/v1/customers/{id}`,
      `GET /api/v1/orders`, `POST /api/v1/orders`, `GET /api/v1/orders/{id}`,
      `PUT /api/v1/orders/{id}`, `PATCH /api/v1/orders/{id}`, `DELETE /api/v1/orders/{id}`,
      `GET /api/v1/categories`, `GET /api/v1/categories/{slug}`,
      `GET /api/v1/posts`, `GET /api/v1/posts/{id}`,
      `GET /api/v1/comments`, `GET /api/v1/comments/{id}`,
      `GET /api/v1/reviews`, `GET /api/v1/reviews/{id}`, `GET /api/v1/reviews/by-rating/{rating}`,
      `GET /api/v1/payments`, `GET /api/v1/payments/{id}`, `GET /api/v1/payments/by-date/{date}`,
      `GET /api/v1/users/{id}/orders`, `GET /api/v1/users/{id}/posts`, `POST /api/v1/users/{id}/posts`,
      `GET /api/v1/posts/{id}/comments`, `POST /api/v1/posts/{id}/comments`,
      `GET /api/v1/products/{id}/reviews`, `GET /api/v1/products/{id}/category`,
      `GET /api/v1/orders/{id}/products`, `GET /api/v1/search`, `GET /api/v1/status/{code}`.
      (That is 46 operations gaining a new `security: []` field, plus `GET /auth/token-info` having
      its incorrect existing one corrected — 47 operations touched in total, verified by scripted
      inspection of every `security` key across the document's 96 pre-existing operations before
      this task.)
- [ ] T003 [P] [US1] Create `tests/openapiSchema.test.ts` (depends on T002 for the "every operation
      has an explicit `security` array" and "`/auth/token-info` is `[]`" assertions to pass): read
      `openapi.yaml`'s raw text (e.g. `readFileSync(join(__dirname, "..", "openapi.yaml"), "utf-8")`)
      and assert it contains none of the literal substrings `"allOf:"`, `"oneOf:"`, `"anyOf:"`
      (SC-005; project memory `openapi-no-combinators`). Separately, parse it with `js-yaml` and, for
      every path entry and every one of `get`/`post`/`put`/`patch`/`delete` present under it, assert
      `Array.isArray(operation.security)` is `true` — i.e. every operation has an explicit `security`
      array (possibly empty), never `undefined` (FR-005, FR-006; regression-proofs T002 so a future
      spec cannot reintroduce an operation with an implied-but-unstated or incorrect auth
      requirement); and assert `operation.responses` is a non-empty object (every operation documents
      at least one response). Add two more dependency-free structural checks that together
      approximate SC-005's "passes structural validation with a standard OpenAPI 3.x validator"
      without introducing a new npm dependency (plan.md's Technical Context already commits to none):
      **(a)** recursively walk the parsed document collecting every string value found under a
      `$ref` key, and for each one (all of the form `#/components/...`) resolve it by splitting on
      `/` and indexing into the parsed document, asserting the resolved value is not `undefined` —
      i.e. every `$ref` in the document points at something that actually exists; **(b)** assert
      `parsed.openapi` matches `/^3\.\d+\.\d+$/` and `parsed.info?.title` and `parsed.info?.version`
      are both non-empty strings (the minimal required top-level fields a real OpenAPI 3.x validator
      would also check first).
- [ ] T004 [P] [US1] Create `tests/openapiDocs.test.ts`: `GET /openapi.json` → `200`, no auth header
      needed, `res.body.openapi` starts with `"3."`, `Object.keys(res.body.paths).length > 0`.
      `GET /openapi.yaml` → `200`, no auth header needed, `content-type` includes `yaml` or `text`;
      parse the returned text with `js-yaml` and assert `Object.keys(parsed.paths).sort()` equals
      `Object.keys(jsonRes.body.paths).sort()` — the JSON and YAML documents describe the identical
      path surface (spec.md Edge Cases: "`GET /openapi.json` and `GET /openapi.yaml`... MUST
      describe an identical API surface").
- [ ] T005 [US1] Create `tests/routeParity.test.ts` (depends on T001): import `listAppRoutes` from
      `./helpers/listAppRoutes`, `app` from `../src/app`, and parse `openapi.yaml` with `js-yaml`.
      Build the live set from `listAppRoutes(app)` as `"${method} ${path}"` strings. Build the
      documented set by iterating `parsed.paths` and, for each path, each of
      `get`/`post`/`put`/`patch`/`delete` present, emitting `"${METHOD} ${path}"`. Assert the two
      sets are equal — compute `liveOnly` (in live, not documented) and `docOnly` (documented, not
      live) as sorted arrays and assert both are empty, printing them in the assertion message on
      failure so a future drift is immediately diagnosable (SC-001, FR-011).

**Checkpoint**: User Story 1 fully functional and independently testable — the document is proven,
by automated test, to match the live server's route surface exactly, with every operation's auth
requirement explicit and zero schema combinators (quickstart.md Scenario 1).

---

## Phase 4: User Story 2 - Explore and Exercise Endpoints Interactively Without Writing Code (Priority: P2)

**Goal**: Confirm `GET /docs` (already implemented, Spec 001, serving the same document User Story
1 just proved accurate) is reachable, unauthenticated, and renders the interactive Swagger UI.

**Independent Test**: Run `npm test -- tests/openapiDocs.test.ts`, then manually open `/docs` in a
browser and execute "try it out" against a protected and an unprotected operation. See
quickstart.md Scenario 2.

### Implementation for User Story 2

- [ ] T006 [US2] Extend `tests/openapiDocs.test.ts` (depends on T004): add `GET /docs` → `200`, no
      auth header needed, `content-type` includes `text/html`, response body (as text) contains the
      case-insensitive substring `"swagger-ui"` — a smoke test proving the interactive UI route
      itself is wired and serving real markup. Full "try it out" execution (submitting a live
      request from the rendered page, including supplying a JWT via the UI's "Authorize" dialog) is
      not automatable through Supertest against `swagger-ui-express`'s client-side JavaScript and is
      instead validated manually per quickstart.md Scenario 2 — record that manual pass/fail in the
      Polish phase (T017).

**Checkpoint**: User Stories 1 and 2 both work independently — `/docs` is proven reachable and
serving the same accurate, combinator-free document (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Enumerate Every Route Programmatically for Test-Coverage Bookkeeping (Priority: P3)

**Goal**: `GET /api/v1/routes` returns every implemented route (method, path, description, auth
requirement), sourced from a hand-authored catalog that is itself cross-checked against both the
live Express app and `openapi.yaml` — closing the last gap CLAUDE.md's endpoint list calls for.

**Independent Test**: `GET /api/v1/routes` returns `data.length === 97` with accurate auth
requirements, and `npm test -- tests/routeParity.test.ts` (extended in this phase) confirms the
catalog itself never drifts from the live app or the OpenAPI document. See quickstart.md
Scenario 3.

### Implementation for User Story 3

- [ ] T007 [P] [US3] Create `src/models/routeInfo.ts` (data-model.md "RouteInfo"/"AuthRequirement"):
      `export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";` `export type AuthType =
      "none" | "jwt" | "apiKey" | "basic" | "adminToken";` `export interface AuthRequirement { type:
      AuthType; detail?: string; }` `export interface RouteInfo { method: HttpMethod; path: string;
      description: string; auth: AuthRequirement; }` — flat shapes only, no nested union, per
      research.md Decision 2 and project memory `openapi-no-combinators`.
- [ ] T008 [US3] Create `src/data/routeRegistry.catalog.ts` (depends on T007; data-model.md
      "Coverage inventory"): export `const routeRegistry: RouteInfo[]` containing exactly one entry
      per method+path pair below (97 total), `path` using `{param}` brace notation matching
      `openapi.yaml`, `auth` built per the type/detail rules in data-model.md (`type: "none"` unless
      listed otherwise below; `detail` present only where shown):

      | Method | Path | Description | Auth |
      |---|---|---|---|
      | GET | /health | Combined health status | none |
      | GET | /health/live | Liveness probe | none |
      | GET | /health/ready | Readiness probe | none |
      | GET | /version | Application version | none |
      | GET | /api/v1/info | Running instance information | none |
      | GET | /api/v1/routes | List every implemented route with its method, path, description, and auth requirement | none |
      | GET | /api/v1/users | List users | none |
      | POST | /api/v1/users | Create a user | none |
      | GET | /api/v1/users/{id} | Get a user by id | none |
      | PUT | /api/v1/users/{id} | Replace a user | none |
      | PATCH | /api/v1/users/{id} | Partially update a user | none |
      | DELETE | /api/v1/users/{id} | Delete a user | none |
      | GET | /api/v1/products | List products | none |
      | POST | /api/v1/products | Create a product | none |
      | GET | /api/v1/products/{id} | Get a product by id | none |
      | PUT | /api/v1/products/{id} | Replace a product | none |
      | PATCH | /api/v1/products/{id} | Partially update a product | none |
      | DELETE | /api/v1/products/{id} | Delete a product | none |
      | GET | /api/v1/customers | List customers | none |
      | POST | /api/v1/customers | Create a customer | none |
      | GET | /api/v1/customers/{id} | Get a customer by id | none |
      | PUT | /api/v1/customers/{id} | Replace a customer | none |
      | PATCH | /api/v1/customers/{id} | Partially update a customer | none |
      | DELETE | /api/v1/customers/{id} | Delete a customer | none |
      | GET | /api/v1/orders | List orders | none |
      | POST | /api/v1/orders | Create an order | none |
      | GET | /api/v1/orders/{id} | Get an order by id | none |
      | PUT | /api/v1/orders/{id} | Replace an order | none |
      | PATCH | /api/v1/orders/{id} | Partially update an order | none |
      | DELETE | /api/v1/orders/{id} | Delete an order | none |
      | GET | /api/v1/users/{id}/orders | List orders placed by customers linked to a user | none |
      | GET | /api/v1/users/{id}/posts | List posts authored by a user | none |
      | POST | /api/v1/users/{id}/posts | Create a post authored by a user | none |
      | GET | /api/v1/posts/{id}/comments | List comments on a post | none |
      | POST | /api/v1/posts/{id}/comments | Create a comment on a post | none |
      | GET | /api/v1/products/{id}/reviews | List reviews for a product | none |
      | GET | /api/v1/products/{id}/category | Get the category record for a product | none |
      | GET | /api/v1/orders/{id}/products | List the distinct products referenced by an order's line items | none |
      | GET | /api/v1/categories | List categories | none |
      | GET | /api/v1/categories/{slug} | Get a category by slug | none |
      | GET | /api/v1/posts | List posts | none |
      | GET | /api/v1/posts/{id} | Get a post by id | none |
      | GET | /api/v1/comments | List comments | none |
      | GET | /api/v1/comments/{id} | Get a comment by id | none |
      | GET | /api/v1/reviews | List reviews | none |
      | GET | /api/v1/reviews/{id} | Get a review by id | none |
      | GET | /api/v1/reviews/by-rating/{rating} | List reviews with a given rating | none |
      | GET | /api/v1/payments | List payments | none |
      | POST | /api/v1/payments | Create a payment, honoring Idempotency-Key for safe retries | none |
      | GET | /api/v1/payments/{id} | Get a payment by id | none |
      | GET | /api/v1/payments/by-date/{date} | List payments processed on a given calendar date | none |
      | GET | /api/v1/search | Cross-resource free-text search | none |
      | GET | /api/v1/status/{code} | Demonstrate a specific HTTP status code | none |
      | GET | /api/v1/test | Generic, composable test-scenario endpoint — the primary k6 hook | none |
      | POST | /auth/login | Log in with a demo account, receiving an access/refresh token pair | none |
      | POST | /auth/logout | Revoke the caller's current session | jwt |
      | POST | /auth/refresh | Exchange a valid refresh token for a new access/refresh pair | none |
      | GET | /auth/me | Return the authenticated identity | jwt |
      | POST | /auth/token | Issue a token directly for a given role/scopes/kind | none |
      | GET | /auth/token-info | Decode and diagnose any token's validity state | none |
      | GET | /api/v1/protected | Demonstrates 401 (unauthenticated) vs 403 (wrong role) vs 200 | jwt, detail: "role: admin" |
      | GET | /api/v1/role/{role} | Demonstrates role enforcement | jwt, detail: "role must match the {role} path parameter" |
      | GET | /api/v1/scope/{scope} | Demonstrates scope enforcement | jwt, detail: "scope must match the {scope} path parameter (or admin)" |
      | POST | /auth/api-key | Issue a new API key | none |
      | POST | /auth/api-key/revoke | Revoke an API key | apiKey |
      | GET | /api-key/protected | Demonstrates API-key auth | apiKey |
      | GET | /auth-test/basic | Demonstrates HTTP Basic Auth | basic |
      | GET | /delay/{ms} | Waits {ms} milliseconds before responding | none |
      | GET | /delay | Waits ?ms= milliseconds before responding | none |
      | GET | /payload/{preset} | Returns a generated response body sized to a named preset | none |
      | GET | /payload | Returns a generated response body of ?size= bytes | none |
      | POST | /payload | Echoes the exact byte length of the posted request body | none |
      | GET | /content/{type} | Returns a response in the requested content type | none |
      | POST | /content/{type} | Validates the request's Content-Type header matches {type} | none |
      | GET | /headers | Echoes every incoming request header except Authorization, Cookie, and X-API-Key | none |
      | GET | /cookies | Reports every cookie present on the request | none |
      | POST | /cookies | Sets an arbitrary named cookie | none |
      | DELETE | /cookies | Clears one named cookie via ?name= | none |
      | GET | /rate-limit | Per-caller rate-limit demo | none |
      | GET | /flaky | Simulates a flaky dependency | none |
      | GET | /cache/resource | Returns a cacheable demo resource with ETag/Last-Modified | none |
      | PUT | /cache/resource | Updates the cache-demo resource's content | none |
      | GET | /files | Lists every currently stored file's metadata | none |
      | POST | /files | Uploads one file via multipart/form-data | none |
      | GET | /files/{id} | Downloads a stored file's exact original bytes | none |
      | DELETE | /files/{id} | Deletes a stored file | none |
      | GET | /errors/validation | Deterministic 400 Bad Request demo | none |
      | GET | /errors/not-found | Deterministic 404 Not Found demo | none |
      | GET | /errors/conflict | Deterministic 409 Conflict demo | none |
      | GET | /errors/unauthorized | Deterministic 401 Unauthorized demo | none |
      | GET | /errors/forbidden | Deterministic 403 Forbidden demo | none |
      | GET | /errors/rate-limit | Deterministic 429 Too Many Requests demo | none |
      | GET | /errors/server-error | Deterministic 500 Internal Server Error demo | none |
      | GET | /errors/service-unavailable | Deterministic 503 Service Unavailable demo | none |
      | GET | /errors/timeout | Deterministic 408 Request Timeout demo | none |
      | POST | /admin/reset | Restore every CRUD/read-oriented resource, the rate limiter, the idempotency store, the cache-demo resource, and uploaded files to their seeded state | adminToken |
      | POST | /admin/auth/reset | Restore issued JWT session/refresh-token records and issued/revoked API keys to their initial state | adminToken |

      Sort the final array by `path` then `method` (matching `listAppRoutes`'s own sort order, so a
      diff between the two is stable and readable). Double-check the row count is 97 before moving
      on (`routeRegistry.length === 97`).
- [ ] T009 [US3] Create `src/services/routeRegistry.service.ts` (depends on T008): `import {
      routeRegistry } from "../data/routeRegistry.catalog"; import type { RouteInfo } from
      "../models/routeInfo";` export `function listRoutes(): RouteInfo[] { return routeRegistry; }`
      — the catalog is already sorted and immutable at module scope, so no copying or re-sorting is
      needed here.
- [ ] T010 [US3] Create `src/controllers/routes.controller.ts` (depends on T009): `import type {
      Request, Response } from "express"; import { listRoutes } from
      "../services/routeRegistry.service";` export `function getRoutes(_req: Request, res: Response):
      void { res.status(200).json({ data: listRoutes() }); }` — mirrors `info.controller.ts`'s shape
      (no input to validate, no error path).
- [ ] T011 [US3] Create `src/routes/routes.routes.ts` (depends on T010), mirroring
      `info.routes.ts` exactly: `import { Router } from "express"; import { getRoutes } from
      "../controllers/routes.controller"; import { methodNotAllowedHandler } from
      "../middleware/methodNotAllowed"; export const routesRouter = Router();
      routesRouter.get("/routes", getRoutes); routesRouter.all("/routes",
      methodNotAllowedHandler);`.
- [ ] T012 [US3] Wire `routesRouter` into `src/app.ts` (depends on T011): add `import { routesRouter
      } from "./routes/routes.routes";` and `apiRouter.use(routesRouter);` alongside
      `apiRouter.use(infoRouter);` (mounted under `config.apiPrefix`, per research.md Decision 4 —
      CLAUDE.md lists this endpoint as `/api/v1/routes`, unlike the prefix-less
      `/openapi.json`/`/openapi.yaml`/`/docs`).
- [ ] T013 [US3] Merge `contracts/route-discovery.openapi.yaml` into root `openapi.yaml` (depends on
      T012): add its `paths./api/v1/routes` entry and its three `components.schemas` entries
      (`AuthRequirement`, `RouteInfo`, `RoutesListResponse`) into the corresponding root-document
      sections; update the existing `Meta` tag's `description` to also mention route discovery (the
      fragment's own `tags` entry shows the intended wording). No `allOf`/`oneOf`/`anyOf` anywhere in
      what's added (project memory `openapi-no-combinators`).
- [ ] T014 [P] [US3] Create `tests/routes.test.ts` (depends on T012): `GET /api/v1/routes` with no
      auth header → `200` with `{ data: [...] }`, `res.body.data.length === 97` (FR-009). Spot-check
      specific entries: find the entry for `{ method: "POST", path: "/admin/reset" }` and assert
      `auth: { type: "adminToken" }`; find `{ method: "GET", path: "/api/v1/role/{role}" }` and
      assert `auth.type === "jwt"` and `auth.detail` is a non-empty string; find `{ method: "GET",
      path: "/health" }` and assert `auth: { type: "none" }` (FR-010). `POST /api/v1/routes` →
      `405` via `methodNotAllowedHandler`.
- [ ] T015 [US3] Extend `tests/routeParity.test.ts` (depends on T005, T008, T013, and on T002's
      `/auth/token-info` correction — without it, this task's own security-consistency check would
      fail): import
      `routeRegistry` from `../src/data/routeRegistry.catalog`. Build a third set from it as
      `"${method} ${path}"` strings and assert it is equal to both the live-route set and the
      documented-path set already computed in T005 (three-way closure: live === catalog === doc;
      SC-001, FR-011). Additionally, for every catalog entry, look up the same method+path's
      `security` array in the parsed `openapi.yaml` and assert it is consistent with the catalog's
      `auth.type` (`"none"` ⇢ `[]`; `"jwt"` ⇢ `[{ bearerAuth: [] }]`; `"apiKey"` ⇢ `[{ apiKeyAuth: []
      }]`; `"basic"` ⇢ `[{ basicAuth: [] }]`; `"adminToken"` ⇢ `[{ adminTokenAuth: [] }]`) — this is
      the automated form of SC-002/FR-010 ("100% of endpoints that enforce authentication have their
      exact scheme(s)... correctly represented... in `/api/v1/routes`").

**Checkpoint**: All three user stories independently functional — `GET /api/v1/routes` is live,
accurate, and its catalog is provably in sync with both the live server and the OpenAPI document
(quickstart.md Scenario 3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-suite verification and the manual checks CLAUDE.md's testing expectations still
call for alongside the new automated gate.

- [ ] T016 [P] Run `npm test` and confirm the full suite — every existing Specs 001-011 test file,
      unaffected by this feature's changes, plus this feature's five new/extended test files
      (`tests/openapiSchema.test.ts`, `tests/openapiDocs.test.ts`, `tests/routeParity.test.ts`,
      `tests/routes.test.ts`) — passes.
- [ ] T017 Execute the manual validation scenarios in `specs/012-openapi-docs-route-discovery/
      quickstart.md` against a running `npm run dev` server, including Scenario 2's browser-based
      "try it out" pass referenced by T006 (not automatable via Supertest).
- [ ] T018 [P] Final spot-check: confirm `/docs`, `/openapi.json`, `/openapi.yaml`, and
      `/api/v1/routes` are mutually consistent on the running server — `curl .../openapi.json | jq
      '.paths | keys | length'` equals `curl .../api/v1/routes | jq '.data | length'` equals `97`,
      and every `$ref` in the merged document resolves with no Swagger UI console errors when
      `/docs` is loaded (constitution: Quality Gates & Spec Parity).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks — no new dependency needed.
- **Foundational (Phase 2)**: T001 has no dependency. It **blocks** T005 (User Story 1) and, via
  T005, indirectly gates T015 (User Story 3)'s extension of the same test file.
- **User Story 1 (Phase 3)**: Depends only on Phase 2 (T001, for T005). No dependency on User
  Story 2 or 3.
- **User Story 2 (Phase 4)**: Depends on T004 (User Story 1) since it extends the same file, but
  its own value (confirming `/docs` is reachable and correct) does not functionally depend on User
  Story 3 existing.
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T007 onward) for its own new endpoint, and on
  T005/T008 for T015's extension of the shared parity test. Does not block User Story 1 or 2 — both
  remain fully valid whether or not User Story 3 has landed yet (T005's generic live-vs-doc
  comparison covers the new route automatically once it exists).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 or 3 in this spec.
- **User Story 2 (P2)**: Extends User Story 1's `tests/openapiDocs.test.ts` file, but its own
  independent test (confirming `/docs` itself) does not require User Story 1's specific assertions
  to have passed first, only the file to exist.
- **User Story 3 (P3)**: Independent new endpoint; only its parity-test extension (T015) touches a
  file User Story 1 created (T005).

### Within Each User Story

- US1: Foundational helper (T001) → doc edit (T002) → schema/combinator test (T003) → doc-serving
  test (T004) → parity test (T005, depends on T001).
- US2: extends the same file as T004 (T006).
- US3: model (T007) → catalog (T008) → service (T009) → controller (T010) → route (T011) →
  `app.ts` wiring (T012) → doc merge (T013) → endpoint test (T014) → parity-test extension (T015,
  depends on T005 and T008).

### Parallel Opportunities

- T003 and T004 (User Story 1) run in parallel (different files, both depend only on the
  already-existing `openapi.yaml`/`/openapi.json`/`/openapi.yaml` endpoints, not on each other).
- T007 (User Story 3's model) can be drafted in parallel with anything in User Story 1/2, since it
  touches a brand-new file with no dependency on them.
- T014 and T018 can run in parallel with other Polish-phase tasks once their own prerequisites
  (T012/T013) are met.
- T002 (the 46-line `openapi.yaml` documentation edit) and T001 (the introspection helper) touch
  different files and can be done in parallel by two developers, though T003's test can only be
  written meaningfully once T002 lands.

---

## Parallel Example: User Story 1

```bash
# Once T001 and T002 are done, these two can be drafted together:
Task: "Create tests/openapiSchema.test.ts (no combinators; every operation has explicit security)"
Task: "Create tests/openapiDocs.test.ts (openapi.json/openapi.yaml validity and equivalence)"
# T005 (routeParity.test.ts) follows once T001 exists.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001 — blocks the parity test).
2. Complete Phase 3: User Story 1 (T002-T005 — the enforced spec/implementation parity gate).
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
4. Deploy/demo if ready — this alone converts the constitution's manual spot-check into a permanent
   regression test for every operation that already exists.

### Incremental Delivery

1. Foundational → live-route introspection ready.
2. User Story 1 → test independently → deploy/demo (MVP! — doc/implementation parity enforced).
3. User Story 2 → test independently → deploy/demo (`/docs` reachability confirmed).
4. User Story 3 → test independently → deploy/demo (`GET /api/v1/routes` live, catalog
   cross-checked three ways).
5. Polish → full suite green, manual quickstart pass, final cross-surface spot-check.

### Parallel Team Strategy

With multiple developers: complete Foundational together first; then Developer A takes User Story
1 (doc edit + three test files) while Developer B drafts User Story 3's model/catalog/service files
in parallel (T007-T009 depend on nothing from User Story 1); User Story 3's `app.ts`/`openapi.yaml`
wiring and its parity-test extension (T012-T015) wait until both User Story 1's T005 and its own
T008 exist.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- T002's 47-operation list (46 additions + 1 correction) was produced by scripted inspection of
  every operation's `security` key in the pre-existing `openapi.yaml` (96 operations total before
  this feature), cross-referenced against each route's actual middleware wiring in `src/routes/*.ts`
  — not estimated. Cross-check the count against the file itself before considering T002 done, and
  confirm specifically that `GET /auth/token-info` ends with `security: []`, not `[{ bearerAuth: []
  }]`.
- `tests/routeParity.test.ts` (T005, extended by T015) is the single source of truth for "is the
  documentation still accurate" going forward — any future spec that adds, renames, or removes a
  route without updating both `openapi.yaml` and (if user-facing) `routeRegistry.catalog.ts` will
  fail this test, which is the entire point of this feature per the roadmap's "verified rather than
  assumed" framing for Spec 012.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies
  that would break User Story 1's or User Story 2's ability to be demoed on their own.
