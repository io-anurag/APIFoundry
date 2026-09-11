# Phase 0 Research: Core CRUD Resources

**Feature**: `002-core-crud-resources` | **Date**: 2026-09-11

Spec 001 already fixed the stack, module layout, and shared conventions this spec must reuse: Express +
TypeScript on Node 20, `zod` for schema validation, the shared `ErrorEnvelope`/`PaginationEnvelope`
shapes, `HttpError` + central error middleware, `X-Request-ID` propagation, and Vitest + Supertest. The
only genuine decisions left open for this spec are how to model and serve four in-memory CRUD resources
consistently. Each is recorded below.

## Decision: In-memory store — one generic keyed store per resource

- **Rationale**: No database exists (constitution: in-memory only). A small generic
  `createInMemoryStore<T>()` helper (a `Map<number, T>` plus an auto-incrementing id counter seeded past
  the highest seed id) gives each resource (`users`, `products`, `orders`, `customers`) independent,
  typed CRUD primitives (`list`, `get`, `create`, `replace`, `patch`, `remove`) without a shared mutable
  namespace between resources. Per-resource isolation also sets up cleanly for the admin/reset spec
  (011) to reset each store independently later.
- **Alternatives considered**: a single shared object keyed by `"${resource}:${id}"` — saves one file but
  loses type safety per resource and makes an eventual per-resource reset harder to reason about.

## Decision: Deterministic seed data — hand-written generator functions, no new dependency

- **Rationale**: FR-002/FR-003 require ≥50 users, ≥50 products, ≥100 orders (plus matching customers),
  reproducible across restarts. Small pure functions (e.g. `for (i = 1; i <= 50; i++)` building each
  record from fixed name/category pools and index-derived fields such as `user${i}@example.com`) are
  trivially deterministic by construction and add zero dependencies — consistent with this project's
  already-minimal dependency set (no faker-style library was pulled in by Spec 001 either).
- **Alternatives considered**: `@faker-js/faker` with a fixed seed — more varied-looking data, but adds a
  dependency whose PRNG output is not guaranteed stable across its own version bumps, which would risk
  the determinism guarantee (constitution Principle II, NON-NEGOTIABLE) unless pinned exactly and never
  upgraded. Not worth the tradeoff for this feature's needs.

## Decision: Request validation — per-resource `zod` schemas, `.strict()`

- **Rationale**: `zod` is already a project dependency (used for env validation in Spec 001). A `Create`
  schema per resource (field types, string/number bounds, enum values, email/format checks) marked
  `.strict()` naturally rejects undocumented fields, directly satisfying FR-013's "one consistent
  documented policy" (reject unknown fields) and FR-012's validation categories. A `Patch` schema is
  derived as `Create.partial()` so there is exactly one field-definition source per resource, not two
  schemas to keep in sync.
- **Alternatives considered**: hand-rolled `if`/`throw` validation per controller — more code per
  resource, and prior experience (Spec 001) already established `zod` as the project's validation
  convention.

## Decision: `PUT` vs `PATCH` semantics on one schema pair

- **Rationale**: `PUT` validates the request body against the resource's full `Create`-shaped schema
  (every mutable field required) and replaces those fields on the existing record; `PATCH` validates
  against `Create.partial()` and merges only the supplied fields. Both reject attempts to set the
  identifier field (the schemas never include it), satisfying FR-014 without extra branching logic.

## Decision: Shared list-query utility for pagination, sorting, and filtering

- **Rationale**: FR-007–FR-010 require identical pagination-envelope shape, `page`/`limit` validation,
  `sort`/`-sort` handling, and filter-combination behavior across all four resources. A single
  `applyListQuery(records, query, options)` utility (parse/validate paging and sort params once, apply
  resource-supplied filter predicates, then slice) run from each resource's service guarantees the four
  resources cannot drift from each other, and is the one place FR-008/FR-009's `400` validation-error
  paths are implemented.
- **Alternatives considered**: bespoke pagination/sort/filter code per resource controller — the more
  files repeat this logic, the more likely one resource silently behaves differently from the others.

## Decision: Cross-resource reference validation — direct synchronous store lookups

- **Rationale**: FR-015 requires rejecting an order whose `customerId` or line-item `productId`s don't
  exist. Because every store is in-memory and in-process, the order service can look up
  `customerStore.get(customerId)` and each `productStore.get(productId)` synchronously during validation
  — no async I/O, no added latency, keeping the endpoint within the constitution's bounded-resource-usage
  principle.

## Runtime target

- **Decision**: No change from Spec 001 — TypeScript on Node.js 20.x, Express 4.x, `zod`, Vitest +
  Supertest.
- **Rationale**: This spec adds resources and validation on top of the existing foundation; it
  introduces no new runtime dependency.

All unknowns from the Technical Context are resolved above; none remain marked `NEEDS CLARIFICATION`.
