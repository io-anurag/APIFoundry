---

description: "Task list template for feature implementation"
---

# Tasks: Admin & Reset

**Input**: Design documents from `/specs/011-admin-reset/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/admin-reset.openapi.yaml](contracts/admin-reset.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. The constitution's Quality Gates ("new or changed endpoints MUST include
corresponding automated test coverage ... before being considered done") make test coverage
mandatory for this project, not optional; CLAUDE.md's Testing Expectations paragraph names the same
general categories this feature touches (auth, rate limiting, idempotency, error handling), though
it does not name "admin/reset" as its own category.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. `adminAuth` (the credential gate FR-001-FR-004 require)
is built once in Foundational because *both* endpoints are unreachable without it — User Story 1's
and User Story 2's own endpoints cannot be exercised at all until it exists. User Story 3 (reject
unauthorized callers) is therefore a test-only phase: the gating behavior it verifies is already
fully implemented by Foundational's `adminAuth`, so US3 adds the dedicated negative-path coverage
proving that guarantee, exactly as spec.md frames it ("a guard rail around functionality that must
exist first to be worth guarding").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-010 layout. No new top-level directories. `src/app.ts` is touched once (US1's route mount);
`tests/helpers/resetStores.ts` (existing, shared by every prior spec's test suite) is refactored in
Foundational to delegate to this feature's own new functions — a behavior-preserving change, not a
new story's concern.

---

## Phase 1: Setup

**Purpose**: Project initialization and new dependencies.

No tasks. This feature adds no new npm dependency — `adminAuth` is a single header/value comparison
following the existing hand-rolled middleware style (`apiKeyAuth.ts`), and `admin.service.ts` only
calls `.reset(...)` methods every referenced store already exposes. Proceed directly to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Create `src/middleware/adminAuth.ts` (data-model.md "Admin Credential" table;
      research.md Decision 2): `import type { NextFunction, Request, Response } from "express";
      import { config } from "../config"; import { HttpError } from "../utils/httpError";` export
      `function adminAuth(req: Request, _res: Response, next: NextFunction): void { const token =
      req.header("X-Admin-Token"); if (!token) { next(new HttpError(401, "UNAUTHORIZED", "Missing
      X-Admin-Token header", { reason: "missing" })); return; } if (token !== config.adminToken) {
      next(new HttpError(403, "FORBIDDEN", "Incorrect admin token", { reason: "incorrect" }));
      return; } next(); }` — an empty-string header value is falsy and hits the `missing` branch
      (FR-002); any non-empty value that doesn't match `config.adminToken` (including one with
      stray whitespace) hits the `403` branch, never crashing (FR-003, spec.md Edge Cases).
- [X] T002 [P] Create `src/models/adminResetResult.ts` (data-model.md "AdminResetResult"): `export
      interface AdminResetResult { message: string; domain: "data" | "auth"; requestId: string; }`
      — no `details`/counts/timestamp fields, per the Clarifications session (FR-013).
- [X] T003 Create `src/services/admin.service.ts` (data-model.md "Data Reset Scope"/"Auth Reset
      Scope" tables; research.md Decision 1): `import { seedUsers } from "../data/users.seed";
      import { seedProducts } from "../data/products.seed"; import { seedCustomers } from
      "../data/customers.seed"; import { seedOrders } from "../data/orders.seed"; import {
      seedCategories } from "../data/categories.seed"; import { seedPosts } from
      "../data/posts.seed"; import { seedComments } from "../data/comments.seed"; import {
      seedReviews } from "../data/reviews.seed"; import { seedPayments } from
      "../data/payments.seed"; import { rateLimitStore } from "../data/rateLimit.store"; import {
      idempotencyStore } from "../data/idempotency.store"; import { cacheResourceStore } from
      "../data/cacheResource.store"; import { fileStore, resetFileSequence } from
      "../data/files.store"; import { resetSeededRandom } from "../utils/seededRandom"; import {
      sessionStore } from "../data/session.store"; import { apiKeyStore } from
      "../data/apiKey.store";` export `function resetDataStores(): void { seedUsers();
      seedProducts(); seedCustomers(); seedOrders(); seedCategories(); seedPosts(); seedComments();
      seedReviews(); seedPayments(); rateLimitStore.reset([]); resetSeededRandom();
      idempotencyStore.reset([]); cacheResourceStore.reset(); fileStore.reset([]);
      resetFileSequence(); }` — call order preserved exactly from `tests/helpers/resetStores.ts`'s
      existing, test-proven dependency order (customers/products before orders, users before
      posts/reviews, posts before comments, products before reviews, orders before payments; FR-005,
      FR-009). export `function resetAuthStores(): void { sessionStore.reset([]);
      apiKeyStore.reset([]); }` (FR-010, FR-012). Neither function calls anything the other
      function calls (FR-008, FR-011 — structural domain isolation, not just tested-for).
- [X] T004 Refactor `tests/helpers/resetStores.ts` to delegate to T003 (depends on T003): replace
      the function body with `resetDataStores(); resetAuthStores();`, importing both from
      `../../src/services/admin.service`; remove the now-unused direct seed/store imports this file
      previously had. Run `npm test` and confirm the entire existing Specs 001-010 suite still
      passes unmodified — this is the safety check proving `resetDataStores`/`resetAuthStores` are
      exactly equivalent to the old inline sequence (research.md Decision 1).

**Checkpoint**: Foundation ready — both endpoints can now be gated, wired, and independently tested.

---

## Phase 3: User Story 1 - Restore Resource Data to Its Seeded State Between Test Runs (Priority: P1) 🎯 MVP

**Goal**: `POST /admin/reset`, gated by `adminAuth`, restores every CRUD/read-oriented resource, the
rate limiter, the idempotency store, the cache-demo resource, uploaded files, and the shared seeded
PRNG to their deterministic seed state — without touching auth-domain state.

**Independent Test**: Mutate several resources, call `POST /admin/reset` with a valid credential,
confirm every resource matches its original seed content and the rate limiter/idempotency store are
cleared, while a token/API key issued beforehand remains valid afterward (FR-008). See
quickstart.md Scenario 1.

### Implementation for User Story 1

- [X] T005 [US1] Create `src/controllers/admin.controller.ts` (depends on T002, T003): `import type
      { Request, Response } from "express"; import { resetDataStores } from
      "../services/admin.service"; import { requestIdOf } from "../middleware/requestId"; import
      type { AdminResetResult } from "../models/adminResetResult";` export `function
      postAdminReset(req: Request, res: Response): void { resetDataStores(); const result:
      AdminResetResult = { message: "Data reset to seed state", domain: "data", requestId:
      requestIdOf(req) }; res.status(200).json(result); }` — ignores `req.body` entirely (spec.md
      Edge Cases: request body content is never consulted).
- [X] T006 [US1] Create `src/routes/admin.routes.ts` (depends on T005, T001): `import { Router }
      from "express"; import * as adminController from "../controllers/admin.controller"; import {
      adminAuth } from "../middleware/adminAuth"; import { methodNotAllowedHandler } from
      "../middleware/methodNotAllowed"; export const adminRouter = Router({ strict: true });
      adminRouter.post("/admin/reset", adminAuth, adminController.postAdminReset);
      adminRouter.all("/admin/reset", methodNotAllowedHandler);` — `adminAuth` runs before the
      controller, so a rejected request never reaches `resetDataStores()` (FR-004).
- [X] T007 [US1] Wire `adminRouter` into `src/app.ts` (depends on T006): `import { adminRouter }
      from "./routes/admin.routes";` and `app.use(adminRouter);` mounted top-level, alongside
      `authRouter`/`apiKeyRouter`/`errorsRouter`/etc. (research.md Decision 4 — CLAUDE.md spells
      `/admin/reset` with no `/api/v1` prefix).
- [X] T008 [P] [US1] Create `tests/admin.test.ts` (depends on T007): `POST /admin/reset` with
      `X-Admin-Token: admin-secret` (the default `config.adminToken` in the test environment) →
      `200` with `{ message, domain: "data", requestId }` matching the response's own
      `X-Request-ID` header. Mutate a resource (e.g. `DELETE /api/v1/products/1`), call
      `POST /admin/reset`, then `GET /api/v1/products/1` → back to its original seeded body
      (SC-001). Drive `rateLimitStore`/`idempotencyStore` state (or call
      `rateLimitStore.create(...)`/`idempotencyStore.create(...)` directly if `RATE_LIMIT_ENABLED`
      is off in the test env), reset, confirm both are cleared (SC-002, FR-006, FR-007). Call
      `POST /admin/reset` twice in a row with no mutation in between → both `200`, no error, data
      unchanged (FR-009). Issue an API key via `POST /auth/api-key` before calling
      `POST /admin/reset`, then confirm `GET /api-key/protected` with that same key still succeeds
      afterward (FR-008 — data reset never touches auth state). `POST /admin/reset` with a JSON
      body (e.g. `{"foo":"bar"}`) → still `200`, body ignored (spec.md Edge Cases).
      `GET /admin/reset` → `405` via `methodNotAllowedHandler`.

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md
Scenario 1).

---

## Phase 4: User Story 2 - Restore Auth State to Its Initial Configuration (Priority: P2)

**Goal**: `POST /admin/auth/reset`, gated by `adminAuth`, invalidates every issued JWT
session/refresh-token record and every issued/revoked API key, restoring the project's demo
credentials to their fresh-start behavior — without touching data-domain state.

**Independent Test**: Issue a JWT and an API key, revoke one of each, call
`POST /admin/auth/reset` with a valid credential, confirm all are unrecognized afterward and a
resource mutation made beforehand is untouched (FR-011). See quickstart.md Scenario 2.

### Implementation for User Story 2

- [X] T009 [US2] Extend `src/controllers/admin.controller.ts` (depends on T005): add `import {
      resetAuthStores } from "../services/admin.service";` and export `function
      postAdminAuthReset(req: Request, res: Response): void { resetAuthStores(); const result:
      AdminResetResult = { message: "Auth state reset to initial configuration", domain: "auth",
      requestId: requestIdOf(req) }; res.status(200).json(result); }`.
- [X] T010 [US2] Extend `src/routes/admin.routes.ts` (depends on T009, T006): add
      `adminRouter.post("/admin/auth/reset", adminAuth, adminController.postAdminAuthReset);
      adminRouter.all("/admin/auth/reset", methodNotAllowedHandler);` — reuses the same
      already-mounted `adminRouter` from T007, so no further `app.ts` change is needed.
- [X] T011 [P] [US2] Extend `tests/admin.test.ts` (depends on T010): `POST /admin/auth/reset` with
      a valid credential → `200` with `{ message, domain: "auth", requestId }`. Issue a session via
      `POST /auth/login` (or `POST /auth/token`) and an API key via `POST /auth/api-key`, revoke one
      of each, call `POST /admin/auth/reset`, then confirm the previously issued
      access/refresh token is rejected by a protected endpoint and the previously issued API key is
      rejected by `GET /api-key/protected` (FR-010, SC-003). Confirm the project's documented demo
      account (`demo.admin`/`admin-pass-1` from `demoAccounts.seed.ts`) can still log in via
      `POST /auth/login` immediately after this reset, exactly as on a fresh start. Mutate a
      resource (e.g. `DELETE /api/v1/products/2`) before calling `POST /admin/auth/reset`, then
      `GET /api/v1/products/2` → still `404` afterward, proving the deletion survived (FR-011,
      quickstart.md Scenario 2). `POST /admin/auth/reset` with nothing issued since the last reset →
      `200`, no error (FR-012). `GET /admin/auth/reset` → `405`.

**Checkpoint**: User Stories 1 and 2 both work independently, and each domain's reset leaves the
other domain untouched (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Prevent Unauthorized Callers From Resetting Server State (Priority: P3)

**Goal**: Confirm the `adminAuth` gate built in Foundational fully protects both endpoints: a
missing credential is rejected `401`, an incorrect one `403`, and neither rejection performs any
reset (FR-002, FR-003, FR-004).

**Independent Test**: Call both endpoints with a missing, empty, or incorrect
`X-Admin-Token`, confirm each attempt returns `401`/`403` and a mutation made just before the call
is still present afterward. See quickstart.md Scenario 3.

### Tests for User Story 3

- [X] T012 [US3] Extend `tests/admin.test.ts` (depends on T008, T011): for each of `POST
      /admin/reset` and `POST /admin/auth/reset` — no `X-Admin-Token` header → `401`
      `UNAUTHORIZED`; `X-Admin-Token: ""` (empty string) → `401` `UNAUTHORIZED` (treated as missing,
      not a partial match); `X-Admin-Token: wrong-value` → `403` `FORBIDDEN`. For each rejection
      case: mutate a resource (e.g. `DELETE /api/v1/products/3`) immediately before the rejected
      call, then confirm `GET /api/v1/products/3` is unaffected by the rejected call itself (still
      reflects only the deliberate mutation, not a reset) — proving no side effect occurred
      (FR-004, SC-004). Confirm calling `POST /admin/reset` then `POST /admin/auth/reset` back to
      back (and in the reverse order) with a valid credential leaves the server equivalent to a
      fresh start across both domains (spec.md Edge Cases).

**Checkpoint**: All three user stories independently functional; both endpoints are fully gated
(quickstart.md Scenario 3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [X] T013 [P] Merge `contracts/admin-reset.openapi.yaml`'s `tags`, `paths`,
      `components.securitySchemes` (`adminTokenAuth`), and `components.schemas`
      (`AdminResetResult`) into the root `openapi.yaml`, reusing the existing
      `Unauthorized`/`Forbidden` response components rather than duplicating them, so `/docs`,
      `/openapi.json`, and `/openapi.yaml` document exactly the 2 operations this spec implements
      (constitution: Quality Gates & Spec Parity). No `allOf`/`oneOf`/`anyOf` combinators (project
      memory: OpenAPI spec must avoid combinators).
- [X] T014 Run `npm test` and confirm the full suite — Specs 001-010's existing tests (including
      the refactored `tests/helpers/resetStores.ts` from T004, unchanged in behavior) plus this
      feature's `tests/admin.test.ts` — passes.
- [X] T015 Execute the manual validation scenarios in `specs/011-admin-reset/quickstart.md` against
      a running `npm run dev` server and confirm every expected status code and response body.
- [X] T016 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 2 new
      operations correctly with no schema errors; confirm `/openapi.json` lists exactly
      `/admin/reset` and `/admin/auth/reset`, the `adminTokenAuth` security scheme is present, and
      every `$ref` in them resolves. Note: `GET /api/v1/routes` is not yet implemented in this
      codebase (Spec 012's deliverable per the roadmap).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks — no new dependency needed.
- **Foundational (Phase 2)**: T001 and T002 have no dependency on each other (different files); T003
  depends on neither but is sequenced after them for readability; T004 depends on T003. All of
  Phase 2 **blocks** every task in Phases 3-5.
- **User Story 1 (Phase 3)**: Depends only on Phase 2. No dependency on User Story 2 or 3.
- **User Story 2 (Phase 4)**: Depends only on Phase 2 for its own implementation (T009-T010), but
  its test task (T011) reuses `tests/admin.test.ts` alongside T008 — sequenced after Phase 3's T008
  for a clean single file, not a functional dependency.
- **User Story 3 (Phase 5)**: Depends on both endpoints existing (T007, T010) since it tests both;
  no new implementation of its own — `adminAuth` (T001) already provides everything it verifies.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 or 3 in this spec.
- **User Story 2 (P2)**: No dependency on User Story 1's controller/route files (separate handler,
  same router); independently testable on its own endpoint.
- **User Story 3 (P3)**: Depends on User Story 1 and 2's routes existing to have something to test
  against; contributes no new production code.

### Within Each User Story

- US1: middleware/model/service (Foundational) → controller → routes → `app.ts` wiring → tests.
- US2: controller extension (same file as US1) → route extension (same router as US1) → tests.
- US3: tests only, extending the same `tests/admin.test.ts` file.

### Parallel Opportunities

- T001 and T002 (Foundational) run in parallel (different files); T003 can be drafted alongside
  them and reconciled before T004.
- User Story 1 (Phase 3) must complete before User Story 2 (Phase 4) touches the same
  `admin.controller.ts`/`admin.routes.ts` files, so the two are sequential in practice even though
  neither *functionally* depends on the other — a second developer could draft US2's handler/route
  in parallel and merge once US1's files exist.
- T013 and T016 (Polish) run in parallel; T014 and T015 are sequential whole-suite/manual checks
  that should follow T013.

---

## Parallel Example: Foundational

```bash
# Once Setup is skipped, these three can be drafted together:
Task: "Create src/middleware/adminAuth.ts"
Task: "Create src/models/adminResetResult.ts"
Task: "Create src/services/admin.service.ts (resetDataStores/resetAuthStores)"
# T004 (refactor tests/helpers/resetStores.ts) follows once admin.service.ts exists.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T004 — blocks everything).
2. Complete Phase 3: User Story 1 (`POST /admin/reset`, full test coverage).
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
4. Deploy/demo if ready — this alone lets an automated suite reset every CRUD resource, the rate
   limiter, and the idempotency store between test runs.

### Incremental Delivery

1. Foundational → `adminAuth` gate and both reset functions ready.
2. User Story 1 → test independently → deploy/demo (MVP!).
3. User Story 2 → test independently → deploy/demo (auth-domain reset, isolated from data reset).
4. User Story 3 → test independently → deploy/demo (negative-path/no-side-effect coverage).
5. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple developers: complete Foundational together first (it blocks everything); then
Developer A takes User Story 1 while Developer B drafts User Story 2's handler/route in parallel,
merging into the shared `admin.controller.ts`/`admin.routes.ts` once User Story 1 lands; User
Story 3 starts once both endpoints exist.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- `adminAuth` (T001) does not special-case `ADMIN_TOKEN`'s documented example default
  (`admin-secret`) — it is compared like any other configured value, per spec.md's Edge Cases; every
  test in this spec calls the endpoints with that same default value as the "valid" credential
  precisely because the test environment doesn't override `ADMIN_TOKEN`.
- Concurrent-request consistency (spec.md Edge Cases: "no partially-reset resource collection") is
  structurally guaranteed rather than separately tested: Node.js's single-threaded event loop means
  `resetDataStores()`/`resetAuthStores()` run to completion synchronously within one request's
  handler before any other request's handler can interleave — there is no `await` inside either
  function.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies
  that would break User Story 1's or User Story 2's ability to be demoed on their own.
