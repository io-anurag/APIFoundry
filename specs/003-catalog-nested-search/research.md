# Phase 0 Research: Read-Only Catalog & Nested Resources + Search

**Feature**: `003-catalog-nested-search` | **Date**: 2026-09-12

Spec 001 fixed the stack and shared conventions (Express + TypeScript on Node 20, `zod` validation,
`ErrorEnvelope`/`PaginationEnvelope`, `HttpError` + central error middleware, `X-Request-ID`, Vitest +
Supertest). Spec 002 established the per-resource numeric in-memory store, the `applyListQuery`
pagination/sort/filter pipeline, and the cross-resource-reference validation pattern (synchronous store
lookups). This spec's genuine new decisions — driven by non-numeric identifiers, author validation, and
cross-resource search — are recorded below.

## Decision: A second, string-keyed store factory alongside the existing numeric one

- **Rationale**: Categories are keyed by a slug derived from their name; Posts and Payments are keyed by
  a randomly generated UUID. In both cases the caller assigns the id *before* the record is stored — the
  opposite of the numeric store, where the store itself owns auto-increment id assignment
  (`create(build: (id: number) => T)`). Forcing one generic factory to cover both id-assignment styles
  would need an awkward "id or id-generator" union parameter and risks touching Spec 002's
  already-implemented, tested numeric store. A second small factory, `createKeyedStore<T extends {id:
  string}>()` (`src/data/keyedStore.ts`), with `create(record: T)` taking a fully-formed record instead of
  a builder callback, keeps both stores simple and leaves `src/data/inMemoryStore.ts` completely
  untouched.
- **Alternatives considered**: Generalizing `createInMemoryStore<T extends {id: K}>()` with a
  generator-or-value union for id assignment — more "unified," but adds a conditional branch to every
  call site and changes a file Spec 002 already shipped and tested, for no behavioral gain.

## Decision: Identifier formats and generation per new resource

- **Category** (`id`: slug, e.g. `electronics`): derived once at seed time from the category's display
  name via a small hand-written `slugify()` helper (lowercase, spaces/punctuation → single hyphens, no
  leading/trailing/double hyphens) — no new dependency.
- **Post**, **Payment** (`id`: UUID): generated with Node's built-in `crypto.randomUUID()` — no new
  dependency (the project has no `uuid` package, and none is needed).
- **Comment**, **Review** (`id`: numeric): continue the existing numeric `createInMemoryStore<T>()`
  auto-increment scheme unchanged.
- This spread deliberately closes the int/UUID/slug parameter-type gap CLAUDE.md calls out, without
  forcing an unnatural id type onto any one resource.

## Decision: Hand-rolled path-parameter validators, one per new id/segment format

- **Rationale**: Following the existing `src/utils/idParam.ts` pattern (parse-or-throw `HttpError(400,
  "VALIDATION_ERROR", ...)`, 404 decided by the caller after a store miss), this spec adds:
  `src/utils/slugParam.ts` (`^[a-z0-9]+(-[a-z0-9]+)*$`), `src/utils/uuidParam.ts` (standard UUID regex),
  `src/utils/dateParam.ts` (`^\d{4}-\d{2}-\d{2}$` plus a round-trip `Date` check so an invalid calendar
  date like `2026-02-30` or `2026-13-01` is rejected, not silently normalized), and
  `src/utils/ratingParam.ts` (integer, 1–5 inclusive). Each is a pure function with no dependency,
  matching the project's existing zero-new-dependency posture for this kind of validation.
- **Alternatives considered**: A date-parsing library (`date-fns`, `dayjs`) — unnecessary weight for a
  single format/range check the constitution's bounded-resource principle doesn't require.

## Decision: Comment/Review authorship — validated `userId`, resolved via existing user store

- **Rationale**: Per the Clarifications session, both `Comment.userId` and `Review.userId` MUST
  reference an existing `User`. This is implemented exactly like Spec 002's `assertCustomerExists` /
  product-reference checks in `order.service.ts`: a synchronous `userStore.get(userId)` lookup during
  write validation (comments) or seed generation (reviews, which have no write path in this spec),
  throwing `HttpError(400, "VALIDATION_ERROR", ...)` on a miss. No new pattern is introduced — this is
  the same cross-reference-validation approach already established.

## Decision: Category ↔ Product-category reconciliation for the ≥20-category seed requirement

- **Rationale**: Spec 002 fixed `PRODUCT_CATEGORIES` to 10 values (`electronics`, `books`, `clothing`,
  `home`, `toys`, `grocery`, `sports`, `beauty`, `automotive`, `other`), but this spec's FR-002 requires
  seeding ≥20 Category records. The spec's own relationship rule is one-directional — every
  `Product.category` value MUST resolve to a Category record, but a Category record does not need any
  product referencing it. Resolution: seed exactly those 10 category records first (guaranteeing
  `products/:id/category` always resolves), then seed ≥10 additional catalog-only category records
  (e.g. `seasonal`, `clearance`, `featured`, `bestsellers`, ...) that exist as independently browsable
  Category data but are not currently used by any seeded product. This satisfies FR-002 without touching
  Spec 002's shipped `ProductCategory` enum or any of its already-implemented code.
- **Alternatives considered**: Expanding `PRODUCT_CATEGORIES` to 20 values — rejected as an
  out-of-scope modification to an already-implemented, prior spec; the project's dependency-first,
  one-spec-at-a-time roadmap treats Spec 002 as closed.

## Decision: Search returns lightweight, normalized hits — not embedded full records

- **Rationale**: `GET /api/v1/search` reads across seven differently-shaped resources (users,
  customers, products, categories, posts, comments, reviews). Returning each resource's full native
  shape in one array would make the combined `data` array's item type effectively `any`, defeating the
  point of a single documented response schema. Instead each hit is a normalized `SearchResult`: `{
  resourceType, id, label, snippet }`, where `label`/`snippet` are drawn from the matched resource's
  name/title/description-style field(s) and `id` lets a client fetch the full record from that
  resource's own endpoint. This mirrors how most real search APIs return lightweight hits rather than
  full embedded documents.
- **Alternatives considered**: A `oneOf` union of all seven full resource schemas per item — technically
  possible in OpenAPI but needlessly heavy for a smoke-test-style endpoint, and harder for consuming
  tools to handle generically.

## Decision: Nested & derived routes live with the resource whose store they read/write

- **Rationale**: Regardless of URL shape, a route belongs with the domain files that own the store it
  touches. `GET /api/v1/users/{id}/orders` and `GET /api/v1/orders/{id}/products` extend the existing
  Spec 002 `order.routes.ts`/`order.controller.ts`/`order.service.ts` (both read the Order store, the
  second also the Product store). `GET`/`POST /api/v1/users/{id}/posts` lives in the new
  `post.*` files (reads/writes the Post store); `GET`/`POST /api/v1/posts/{id}/comments` lives in the new
  `comment.*` files; `GET /api/v1/products/{id}/reviews` and `GET /api/v1/reviews/by-rating/{rating}`
  live in the new `review.*` files; `GET /api/v1/products/{id}/category` lives in the new `category.*`
  files; `GET /api/v1/payments/by-date/{date}` lives in the new `payment.*` files. This keeps each
  resource's validation, store access, and route registration in one place regardless of which parent
  resource's URL segment introduces it — the same "owns the store" convention Spec 002 already follows
  (e.g. `order.service.ts` already reaches into `customerStore`/`productStore` for cross-reference
  checks).
- **Alternatives considered**: Grouping routes strictly by URL prefix (e.g. all `/users/...` routes in
  `user.routes.ts`) — would scatter Post/Comment store access and validation logic across multiple
  unrelated router files, increasing drift risk between a resource's top-level and nested behavior.

## Decision: Nested-parent existence check precedes every nested list/create

- **Rationale**: FR-015 requires a `404` on a nonexistent parent, distinguished from a `200` + empty
  list on a childless-but-existing parent. Each nested handler performs the parent lookup
  (`userStore.get`, `postStore.get`, `productStore.get`, `orderStore.get`) first and throws
  `HttpError(404, "RESOURCE_NOT_FOUND", ...)` before touching the child collection — the same
  order-of-operations Spec 002's single-resource `GET`/`PUT`/`PATCH`/`DELETE` handlers already use.

## Runtime target

- **Decision**: No change from Specs 001–002 — TypeScript on Node.js 20.x, Express 4.x, `zod`, Vitest +
  Supertest. This spec introduces no new runtime dependency (confirmed against `package.json`: no `uuid`
  package exists or is needed, since `crypto.randomUUID()` is a Node built-in).

All unknowns from the Technical Context are resolved above; none remain marked `NEEDS CLARIFICATION`.
