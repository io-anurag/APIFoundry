---

description: "Task list template for feature implementation"
---

# Tasks: Core CRUD Resources

**Input**: Design documents from `/specs/002-core-crud-resources/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/core-crud-resources.openapi.yaml](contracts/core-crud-resources.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations and the constitution's Quality Gates
("new or changed endpoints MUST include corresponding automated test coverage ... before being
considered done") make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation
and testing of each story. User Stories 2–4 extend the same four resources User Story 1 creates (same
endpoints, deeper validation/edge-case/query-parameter coverage) rather than adding new endpoints, so
each depends on User Story 1's implementation tasks being complete — see Dependencies below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec 001
layout. No new top-level directories.

## Phase 1: Setup

**Purpose**: Feature-specific groundwork shared by every later phase.

- [x] T001 [P] Add a test helper `tests/helpers/resetStores.ts` that resets all four in-memory stores
      (users, products, customers, orders) back to their seeded state, for use in `beforeEach()` across
      this spec's test files so mutations in one test never leak into another within the same file.
- [x] T002 [P] Add a shared enum constants module `src/models/enums.ts` exporting, verbatim per
      data-model.md: `USER_ROLES = ["user", "admin", "manager", "readonly"] as const`,
      `USER_STATUSES = ["active", "inactive"] as const`,
      `PRODUCT_CATEGORIES = ["electronics", "books", "clothing", "home", "toys", "grocery", "sports", "beauty", "automotive", "other"] as const`,
      `ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every resource and every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Implement a generic in-memory store `src/data/inMemoryStore.ts`: `createInMemoryStore<T extends { id: number }>()`
      returning `{ list(): T[], get(id): T | undefined, create(data): T, replace(id, data): T | undefined, patch(id, partial): T | undefined, remove(id): boolean }`,
      backed by a `Map<number, T>` plus an auto-incrementing id counter that starts past the highest
      seed id (research.md).
- [x] T004 [P] Implement a shared path-id parsing utility `src/utils/idParam.ts`: given a route's `:id`
      path segment, return a valid positive integer, or throw `HttpError(400, "VALIDATION_ERROR", ...)`
      for malformed (non-numeric), negative, zero, or unreasonably large (e.g. exceeding
      `Number.MAX_SAFE_INTEGER`) values — never throws an unhandled exception (FR-006). Does not handle
      the not-found case (callers issue `RESOURCE_NOT_FOUND` / `404` themselves once a store lookup
      misses).
- [x] T005 [P] Define shared list-query types and parameter validation in `src/models/listQuery.ts`:
      a `ListQuery` type (`page: number`, `limit: number`, `sort?: string`) and a parser that validates
      `page` (integer >= 1, default 1), `limit` (integer 1–100, default 20), and `sort` (a field name or
      a `-`-prefixed field name, checked against a caller-supplied allowed-fields list), throwing
      `HttpError(400, "VALIDATION_ERROR", ...)` on any invalid value (FR-008, FR-009).
- [x] T006 Implement the shared list-query application service `src/services/listQuery.service.ts`:
      `applyListQuery<T>(records: T[], query: ListQuery, options: { allowedSortFields: string[], filters?: Array<(r: T) => boolean> })`
      that filters, then sorts, then paginates `records`, returning `{ data: T[], total: number }` for
      `buildPaginationEnvelope` (depends on T005 for types).

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Full CRUD Lifecycle on a Core Resource (Priority: P1) 🎯 MVP

**Goal**: Full `list`/`get`/`create`/`replace`/`patch`/`delete` for users, products, customers, and
orders, backed by deterministic seed data.

**Independent Test**: For each resource, `POST` a new record, `GET` it individually and in the list,
`PUT` and `PATCH` it, then `DELETE` it and confirm a subsequent `GET` returns `404`; confirm a freshly
started server's collections already contain the documented minimum seed counts.

### Users

- [x] T007 [P] [US1] Create the User model and zod schemas in `src/models/user.ts`: `User` type —
      `id` (integer, server-assigned, immutable), `name` (string, 1–200 chars, required), `email`
      (string, valid email format, unique across users, required), `role` (enum `user`/`admin`/
      `manager`/`readonly`, required), `status` (enum `active`/`inactive`, default `active`),
      `createdAt`/`updatedAt` (ISO 8601 string, server-assigned) — plus `UserCreate` (required: `name`,
      `email`, `role`; optional: `status`) and `UserPatch` (all fields optional), both zod `.strict()`
      to reject unknown fields (FR-013). Import enums from `src/models/enums.ts` (T002).
- [x] T008 [US1] Implement `src/services/user.service.ts`: CRUD backed by
      `createInMemoryStore<User>()` (T003); `create`/`replace` reject a duplicate `email` across all
      other users with a structured `VALIDATION_ERROR`; `list` delegates to `applyListQuery` (T006)
      with `allowedSortFields: ["id", "name", "email", "role", "createdAt"]`.
- [x] T009 [US1] Implement `src/controllers/user.controller.ts`: `listUsers`, `getUserById`,
      `createUser`, `replaceUser`, `patchUser`, `deleteUser` handlers; parse `:id` via
      `src/utils/idParam.ts` (T004); respond `404`/`RESOURCE_NOT_FOUND` when a lookup misses; `201` on
      create, `200` on get/replace/patch, `204` on delete.
- [x] T010 [US1] Implement `src/routes/user.routes.ts` mounting `GET /users`, `POST /users`,
      `GET /users/:id`, `PUT /users/:id`, `PATCH /users/:id`, `DELETE /users/:id`; mount `userRouter` on
      the existing `apiRouter` in `src/app.ts`.
- [x] T011 [US1] Create the deterministic seed generator `src/data/users.seed.ts`: generate exactly 50
      `User` records (ids 1–50) with index-derived `name`/`email` (e.g. `User ${i}` /
      `user${i}@example.com`), cycling deterministically through all 4 `role` values, and populate the
      store from T003 at module load (FR-002, FR-003).
- [x] T012 [P] [US1] Write CRUD lifecycle tests in `tests/users.test.ts`: `POST` → `201` with a
      server-assigned `id`; `GET /users` shows `pagination.total >= 50` (FR-002); `GET /users/:id` →
      `200`; full `PUT` → `200` with all supplied fields replaced; partial `PATCH` → `200` with only the
      supplied field(s) changed; `DELETE` → `204`, then `GET` on the same id → `404` (User Story 1,
      Acceptance Scenarios 1–6). Use `tests/helpers/resetStores.ts` (T001) in `beforeEach`.

### Products

- [x] T013 [P] [US1] Create the Product model and zod schemas in `src/models/product.ts`: `Product`
      type — `id` (integer, server-assigned, immutable), `name` (string, 1–200 chars, required),
      `description` (string, 0–2000 chars, optional, default `""`), `price` (number, > 0, required),
      `category` (enum of the 10 `PRODUCT_CATEGORIES` values, required), `stock` (integer, >= 0,
      required), `createdAt`/`updatedAt` (server-assigned) — plus `ProductCreate` (required: `name`,
      `price`, `category`, `stock`) and `ProductPatch` (all optional), both `.strict()`.
- [x] T014 [US1] Implement `src/services/product.service.ts`: CRUD via the store; reject `price <= 0`
      or `stock < 0` with a structured `VALIDATION_ERROR`; `list` via `applyListQuery` with
      `allowedSortFields: ["id", "name", "price", "stock", "createdAt"]`.
- [x] T015 [US1] Implement `src/controllers/product.controller.ts` (same handler shape as T009).
- [x] T016 [US1] Implement `src/routes/product.routes.ts` mounting the 6 `/products` routes; mount
      `productRouter` on `apiRouter` in `src/app.ts`.
- [x] T017 [US1] Create the seed generator `src/data/products.seed.ts`: generate exactly 50 `Product`
      records (ids 1–50), cycling deterministically through all 10 categories, with index-derived
      `name`/`price`/`stock` (FR-002, FR-003).
- [x] T018 [P] [US1] Write CRUD lifecycle tests in `tests/products.test.ts` (same pattern as T012,
      asserting `pagination.total >= 50`).

### Customers

- [x] T019 [P] [US1] Create the Customer model and zod schemas in `src/models/customer.ts`: `Customer`
      type — `id` (integer, server-assigned, immutable), `name` (string, 1–200 chars, required),
      `email` (string, valid email format, unique across customers, required), `address` (object:
      `street`/`city`/`postalCode`/`country`, all strings, required together), `userId` (integer,
      nullable, optional — when present MUST reference an existing `User.id`), `createdAt`/`updatedAt`
      (server-assigned) — plus `CustomerCreate` (required: `name`, `email`, `address`; optional:
      `userId`) and `CustomerPatch` (all optional), both `.strict()`.
- [x] T020 [US1] Implement `src/services/customer.service.ts`: CRUD via the store; reject a duplicate
      `email` across other customers; when `userId` is present on create/replace/patch, validate it
      resolves against the user store (T008's store instance) and reject with a structured
      `VALIDATION_ERROR` naming `userId` if it does not (FR-020); `list` via `applyListQuery` with
      `allowedSortFields: ["id", "name", "email", "createdAt"]`.
- [x] T021 [US1] Implement `src/controllers/customer.controller.ts` (same handler shape as T009).
- [x] T022 [US1] Implement `src/routes/customer.routes.ts` mounting the 6 `/customers` routes; mount
      `customerRouter` on `apiRouter` in `src/app.ts`.
- [x] T023 [US1] Create the seed generator `src/data/customers.seed.ts`: generate a deterministic set of
      `Customer` records sufficient to back every seeded order (at least as many as the distinct
      customers referenced by `orders.seed.ts`), with a subset's `userId` linked to seeded users
      (FR-002, FR-003).
- [x] T024 [P] [US1] Write CRUD lifecycle tests in `tests/customers.test.ts` (same pattern as T012).

### Orders

- [x] T025 [P] [US1] Create the Order and OrderLineItem model and zod schemas in `src/models/order.ts`:
      `OrderLineItem` — `productId` (integer, required), `quantity` (integer, >= 1, required);
      `Order` type — `id` (integer, server-assigned, immutable), `customerId` (integer, required, MUST
      reference an existing `Customer.id`), `items` (array of `OrderLineItem`, minimum 1 entry,
      required), `status` (enum of the 5 `ORDER_STATUSES` values, required, default `pending`), `total`
      (number, >= 0, server-computed — never accepted from a request body), `createdAt`/`updatedAt`
      (server-assigned) — plus `OrderCreate` (required: `customerId`, `items`; optional: `status`) and
      `OrderPatch` (all optional), both `.strict()` and both omitting `total` entirely so it can never
      be client-supplied.
- [x] T026 [US1] Implement `src/services/order.service.ts`: CRUD via the store; on create/replace,
      validate `customerId` resolves against the customer store (T020's store instance) and every
      `items[].productId` resolves against the product store (T014's store instance), rejecting with a
      structured `VALIDATION_ERROR` naming the offending id if any do not resolve (FR-015); compute
      `total` server-side as the sum of `items[].quantity * product.price`; `list` via `applyListQuery`
      with `allowedSortFields: ["id", "customerId", "status", "total", "createdAt"]`.
- [x] T027 [US1] Implement `src/controllers/order.controller.ts` (same handler shape as T009).
- [x] T028 [US1] Implement `src/routes/order.routes.ts` mounting the 6 `/orders` routes; mount
      `orderRouter` on `apiRouter` in `src/app.ts`.
- [x] T029 [US1] Create the seed generator `src/data/orders.seed.ts`: generate exactly 100 `Order`
      records (ids 1–100), each referencing a valid seeded `customerId` and 1 or more valid seeded
      `productId`s, generated after `users.seed.ts`/`products.seed.ts`/`customers.seed.ts` so every
      reference resolves (FR-002, FR-003).
- [x] T030 [P] [US1] Write CRUD lifecycle tests in `tests/orders.test.ts`: same pattern as T012, plus a
      create using a valid seeded `customerId`/`productId` and asserting the response's `total` is the
      server-computed value, not any client-supplied value.

**Checkpoint**: User Story 1 complete — all four resources are fully CRUD-able against deterministic
seed data. This is the MVP.

---

## Phase 4: User Story 2 - Validation Rejection on Write Operations (Priority: P2)

**Goal**: Every write path across all four resources reliably rejects invalid input with a structured
`400`/`422` error and never mutates data on rejection.

**Independent Test**: Send the FR-012 battery of invalid payloads (missing fields, wrong types, invalid
enum/email/reference values, out-of-bounds, null, empty, unexpected fields) to each resource's write
endpoints and confirm every one is rejected structurally, with no side effects.

- [x] T031 [P] [US2] Add validation-rejection tests to `tests/users.test.ts`: missing required field
      (`name`/`email`/`role`), wrong type (`role` as a number), invalid email format, invalid `role`
      enum value (FR-017), `null` in a required field, empty string for `name`, and an unexpected extra
      field — each asserting `400`/`422` with the standard error envelope and no record created;
      immutable-`id` test (a `PUT`/`PATCH` body containing an `id` field never changes the record's
      actual id, FR-014); a `PUT` sent with a partial body (missing a field full replacement requires)
      → `400`/`422` (Edge Cases).
- [x] T032 [P] [US2] Add validation-rejection tests to `tests/products.test.ts`: missing required field,
      wrong type, `price <= 0`, `stock < 0`, invalid `category` enum value (FR-019), empty `name`, and
      an unexpected extra field; immutable-`id` test; `PUT`-with-partial-body rejection test.
- [x] T033 [P] [US2] Add validation-rejection tests to `tests/customers.test.ts`: missing required
      field, invalid email format, an incomplete `address` (missing one required sub-field), `null` in
      a required field, an unexpected extra field, and a `userId` that does not resolve to an existing
      user (→ `400`/`422` naming `userId`, FR-020); immutable-`id` test; `PUT`-with-partial-body
      rejection test.
- [x] T034 [P] [US2] Add validation-rejection tests to `tests/orders.test.ts`: missing required field,
      invalid `status` enum value (FR-018), `items[].quantity < 1`, `items: []` (below the 1-entry
      minimum), a non-existent `customerId`, a non-existent `items[].productId` (both FR-015), an
      unexpected extra field, and a client-supplied `total` (must be ignored or rejected, never
      trusted); immutable-`id` test; `PUT`-with-partial-body rejection test.
- [x] T035 [US2] Verify each resource's `.strict()` zod schema and service-layer checks
      (`src/models/user.ts`, `product.ts`, `customer.ts`, `order.ts`, `src/services/user.service.ts`,
      `product.service.ts`, `customer.service.ts`, `order.service.ts`) against every case added in
      T031–T034, and fix any gap found so each resolves to `400`/`422` with a field-identifying
      `details` object (this task is bugfixing against T031–T034's tests, not new functionality).

**Checkpoint**: User Stories 1 and 2 both work — CRUD succeeds on valid input and reliably fails closed
on invalid input.

---

## Phase 5: User Story 3 - Path Parameter Edge Cases (Priority: P3)

**Goal**: Every single-resource endpoint across all four resources handles identifier edge cases
(missing, malformed, negative, zero, huge, empty) predictably, never with a server error.

**Independent Test**: Call each single-resource endpoint with the edge-case identifier table and confirm
each returns the documented `400`/`404` without crashing the server.

- [x] T036 [P] [US3] Add path-parameter edge-case tests to `tests/users.test.ts` for
      `GET`/`PUT`/`PATCH`/`DELETE /api/v1/users/{id}`: valid-but-nonexistent id → `404`; malformed
      non-numeric id (e.g. `abc`) → `400`; negative id (`-1`) → `400`; zero id (`0`) → `400`; huge id
      (`99999999999999999999`) → `400`; empty segment (`/api/v1/users/`) → `404`, never `500`
      (FR-005/FR-006); plus a double-`DELETE` test (a second `DELETE` on the same id → `404`, not a
      repeated success, Edge Cases).
- [x] T037 [P] [US3] Add the same path-parameter edge-case and double-`DELETE` test matrix to
      `tests/products.test.ts`.
- [x] T038 [P] [US3] Add the same path-parameter edge-case and double-`DELETE` test matrix to
      `tests/customers.test.ts`.
- [x] T039 [P] [US3] Add the same path-parameter edge-case and double-`DELETE` test matrix to
      `tests/orders.test.ts`.
- [x] T040 [US3] Verify `src/utils/idParam.ts` and each controller's not-found/double-delete handling
      against T036–T039, and fix any gap found so every case resolves to the documented status without
      an unhandled exception (bugfixing against T036–T039's tests, not new functionality).

**Checkpoint**: User Stories 1–3 all work — identifier handling is fully robust across all four
resources.

---

## Phase 6: User Story 4 - Pagination, Sorting, and Filtering on List Endpoints (Priority: P4)

**Goal**: Every resource's list endpoint supports `page`/`limit`/`sort` and at least one resource-
relevant filter, individually and combined, with correct pagination-envelope metadata.

**Independent Test**: Request each resource's collection with various combinations of `page`, `limit`,
`sort`, and the resource's filter parameter, and confirm the returned set and envelope match.

- [x] T041 [P] [US4] Add `role` filter support to `src/services/user.service.ts`'s `list` method, using
      `applyListQuery`'s filter hook (T006) so only records matching the supplied `role` are returned
      (FR-010).
- [x] T042 [P] [US4] Add `category` filter support to `src/services/product.service.ts`'s `list` method.
- [x] T043 [P] [US4] Add `country` filter support (matched against `address.country`) to
      `src/services/customer.service.ts`'s `list` method.
- [x] T044 [P] [US4] Add `status` filter support to `src/services/order.service.ts`'s `list` method.
- [x] T045 [P] [US4] Add pagination + sorting + `role`-filtering tests to `tests/users.test.ts`:
      `page`/`limit` return the correct page with accurate `total`/`totalPages`/`hasNext`/`hasPrevious`
      (FR-007); `page=0` and a negative or non-numeric `limit` → `400` (FR-008); `sort=name` ascending,
      `sort=-name` descending, `sort=notAField` → `400` (FR-009); `role` filter alone and combined with
      pagination/sort, and the same repeated-conflicting-filter-parameter request resolved identically
      on every call (FR-010, Edge Cases).
- [x] T046 [P] [US4] Add the equivalent pagination + sorting + `category`-filtering test set to
      `tests/products.test.ts`.
- [x] T047 [P] [US4] Add the equivalent pagination + sorting + `country`-filtering test set to
      `tests/customers.test.ts`.
- [x] T048 [P] [US4] Add the equivalent pagination + sorting + `status`-filtering test set to
      `tests/orders.test.ts`.

**Checkpoint**: All four user stories are independently functional and tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification across all four user stories.

- [x] T049 [P] Add an `X-Request-ID` presence assertion to one representative test in each of
      `tests/users.test.ts`, `tests/products.test.ts`, `tests/customers.test.ts`, and
      `tests/orders.test.ts`, confirming FR-016 holds for this spec's endpoints too.
- [x] T050 [P] Merge `contracts/core-crud-resources.openapi.yaml`'s `tags`, `paths`, and
      `components.schemas`/`components.parameters` into the root `openapi.yaml`, so `/docs`,
      `/openapi.json`, and `/openapi.yaml` document exactly the endpoints this spec implements
      (constitution: Quality Gates & Spec Parity).
- [x] T051 Run `npm test` and confirm the full suite — Spec 001's existing tests plus this spec's
      `tests/users.test.ts`, `products.test.ts`, `customers.test.ts`, `orders.test.ts` — passes.
- [x] T052 Execute the manual validation scenarios in
      `specs/002-core-crud-resources/quickstart.md` against a running `npm run dev` server and confirm
      every expected status code and behavior.
- [x] T053 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 24 new
      operations (6 each for users/products/customers/orders) correctly, with no schema errors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Delivers the endpoints every later
  story extends.
- **User Stories 2–4 (Phases 4–6)**: Each depends on **User Story 1** being complete (they add
  validation depth, edge-case depth, and query-parameter depth to the same endpoints User Story 1
  creates — they do not add new endpoints). Once US1 is done, US2/US3/US4 may proceed in any order or
  in parallel, since they touch different concerns (validation vs. path params vs. query params) even
  though they share the same test files per resource.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- US1: within each resource sub-group, model → service → controller → routes (+ `app.ts` wiring) →
  seed → tests, in that order; the four resources (users/products/customers/orders) can be built in
  parallel by different contributors, but **orders must be seeded after** users/products/customers
  (T029 depends on T011, T017, T023) because its records reference their ids.
- US2/US3/US4: filter/gap-fixing tasks (where present) come after the corresponding test-writing tasks
  for the same phase, since they are verified and fixed against those tests.

### Parallel Opportunities

- T001 and T002 (Setup) run in parallel.
- T004 and T005 (Foundational) run in parallel; T006 depends on T005.
- Within US1, the four resources' model-creation tasks (T007, T013, T019, T025) run in parallel; each
  resource's CRUD lifecycle test task (T012, T018, T024, T030) runs in parallel with the others (each
  is a distinct file), once its own resource's routes and seed are in place.
- Within US2, T031–T034 (one test file per resource) run in parallel; T035 (fix-up) runs after all four.
- Within US3, T036–T039 (one test file per resource) run in parallel; T040 (fix-up) runs after all four.
- Within US4, T041–T044 (one service file per resource) run in parallel with each other; T045–T048 (one
  test file per resource) run in parallel with each other.

---

## Parallel Example: User Story 1

```bash
# Launch all four resources' model-creation tasks together:
Task: "Create the User model and zod schemas in src/models/user.ts"
Task: "Create the Product model and zod schemas in src/models/product.ts"
Task: "Create the Customer model and zod schemas in src/models/customer.ts"
Task: "Create the Order and OrderLineItem model and zod schemas in src/models/order.ts"

# Once each resource's own routes + seed are wired, launch all four CRUD lifecycle test tasks together:
Task: "Write CRUD lifecycle tests in tests/users.test.ts"
Task: "Write CRUD lifecycle tests in tests/products.test.ts"
Task: "Write CRUD lifecycle tests in tests/customers.test.ts"
Task: "Write CRUD lifecycle tests in tests/orders.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (all four resources' full CRUD + seed data).
4. **STOP and VALIDATE**: run the User Story 1 section of `quickstart.md` independently.
5. This is a usable MVP: automated testing tools already have a full CRUD target on all four resources.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate independently → MVP.
3. User Story 2 → validate independently → negative-testing coverage lands.
4. User Story 3 → validate independently → identifier robustness lands.
5. User Story 4 → validate independently → query-parameter coverage lands.
6. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple contributors: complete Setup + Foundational together; one contributor per resource inside
User Story 1 (users/products/customers/orders), noting orders' seed depends on the other three; once
User Story 1 is merged, one contributor per remaining story (US2/US3/US4) in parallel.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- Every write endpoint's `.strict()` zod schema is the primary mechanism satisfying FR-011–FR-014 and
  FR-017–FR-020; test tasks (US2) verify it, they do not re-implement it.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies that
  would break a later story's ability to be demoed on its own once User Story 1 exists.
