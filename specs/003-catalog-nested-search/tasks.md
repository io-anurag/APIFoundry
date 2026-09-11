---

description: "Task list template for feature implementation"
---

# Tasks: Read-Only Catalog & Nested Resources + Search

**Input**: Design documents from `/specs/003-catalog-nested-search/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/catalog-nested-search.openapi.yaml](contracts/catalog-nested-search.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations and the constitution's Quality Gates
("new or changed endpoints MUST include corresponding automated test coverage ... before being
considered done") make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation
and testing of each story. Per plan.md's "owns the store" convention, a nested route is implemented in
the domain files of the resource whose store it reads/writes, regardless of which resource's URL
segment introduces it (e.g. `/users/:id/posts` lives in `post.*` files, not `user.*`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001/002 layout. No new top-level directories.

## Phase 1: Setup

**Purpose**: Feature-specific groundwork shared by every later phase.

- [X] T001 [P] Add `PAYMENT_STATUSES = ["pending", "completed", "failed", "refunded"] as const` and
      export a `PaymentStatus` type from `src/models/enums.ts` (data-model.md, Clarifications).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every new resource and every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Implement a string-keyed in-memory store factory `src/data/keyedStore.ts`:
      `createKeyedStore<T extends { id: string }>()` returning `{ list(): T[], get(id): T | undefined,
      create(record: T): T, replace(id, build): T | undefined, patch(id, partial): T | undefined,
      remove(id): boolean, reset(records: T[]): void }` — the same shape as `src/data/inMemoryStore.ts`
      (unchanged, reused for Comment/Review) except `create` takes a fully-formed record instead of an
      id-builder callback, since the caller assigns the id itself (slug or UUID) before storing
      (research.md).
- [X] T003 [P] Implement `src/utils/slugParam.ts`: parse a category `:slug` path segment against
      `^[a-z0-9]+(-[a-z0-9]+)*$`, throwing `HttpError(400, "VALIDATION_ERROR", ...)` on a non-matching
      or empty segment; never handles the not-found case (FR-006).
- [X] T004 [P] Implement `src/utils/uuidParam.ts`: parse a post/payment `:id` path segment against a
      standard UUID format (8-4-4-4-12 hex groups), throwing `HttpError(400, "VALIDATION_ERROR", ...)`
      on a malformed or empty segment; never handles the not-found case (FR-006).
- [X] T005 [P] Implement `src/utils/dateParam.ts`: parse a `:date` path segment matching `YYYY-MM-DD`
      AND representing a real calendar date (round-trip through `Date` to catch e.g. `2026-13-01` or
      `2026-02-30`), throwing `HttpError(400, "VALIDATION_ERROR", ...)` on format or calendar failure
      (FR-007).
- [X] T006 [P] Implement `src/utils/ratingParam.ts`: parse a `:rating` path segment as an integer from 1
      to 5 inclusive, throwing `HttpError(400, "VALIDATION_ERROR", ...)` otherwise (FR-008).

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Browse the Read-Only Catalog (Priority: P1) 🎯 MVP

**Goal**: List and get-by-id for categories, posts, comments, reviews, and payments, backed by
deterministic seed data; every write method on these five resources' top-level URLs returns `405`.

**Independent Test**: `GET` each resource's collection and several individual records' own URLs and
confirm the standard envelopes and documented seed volumes; confirm `POST`/`PUT`/`PATCH`/`DELETE` on
any of these URLs returns `405`.

### Categories

- [X] T007 [P] [US1] Create the Category model in `src/models/category.ts`: `Category` type — `id`
      (string slug, server-assigned at seed time, immutable), `name` (string, 1–100 chars), `description`
      (string, 0–500 chars, defaults to `""`), `createdAt` (ISO 8601 string, server-assigned). No write
      schema — this resource has no write path (data-model.md).
- [X] T008 [US1] Implement `src/services/category.service.ts`: `listCategories(rawQuery)` via
      `applyListQuery` with `allowedSortFields: ["id", "name", "createdAt"]`; `getCategoryBySlug(slug)`
      throwing `HttpError(404, "RESOURCE_NOT_FOUND", ...)` on a miss.
- [X] T009 [US1] Implement `src/controllers/category.controller.ts`: `listCategories`,
      `getCategoryBySlug` handlers; parse `:slug` via `src/utils/slugParam.ts` (T003).
- [X] T010 [US1] Implement `src/routes/category.routes.ts` mounting `GET /api/v1/categories`,
      `GET /api/v1/categories/:slug`, with `.all()` → `methodNotAllowedHandler` on both paths; mount
      `categoryRouter` on the existing `apiRouter` in `src/app.ts`.
- [X] T011 [US1] Create the deterministic seed generator `src/data/categories.seed.ts`: seed the 10
      `PRODUCT_CATEGORIES` values from `src/models/enums.ts` as Category records first (guaranteeing
      `products/:id/category` always resolves), then at least 10 additional catalog-only category
      records not referenced by any seeded product (e.g. `seasonal`, `clearance`, `featured`,
      `bestsellers`, ...) — at least 20 total, each `id` derived from its `name` via a small hand-written
      `slugify()` helper, populated into the T002 store (FR-002, research.md).
- [X] T012 [P] [US1] Write `tests/categories.test.ts`: `GET /api/v1/categories` →
      `pagination.total >= 20`; `GET /api/v1/categories/{slug}` for a known seeded slug → `200`;
      unknown-but-well-formed slug → `404`; malformed slug (e.g. uppercase or underscore) → `400`;
      `POST`/`PUT`/`PATCH`/`DELETE` on `/api/v1/categories` and `/api/v1/categories/{slug}` → `405`.

### Posts

- [X] T013 [P] [US1] Create the Post model in `src/models/post.ts`: `Post` type — `id` (string UUID,
      server-assigned, immutable), `userId` (integer, references an existing `User.id`), `title`
      (string, 1–200 chars), `body` (string, 1–5000 chars), `publishedAt`/`createdAt`/`updatedAt` (ISO
      8601 string, server-assigned). No write schema yet — `PostCreate` is added in User Story 2
      (data-model.md).
- [X] T014 [US1] Implement `src/services/post.service.ts`: `listPosts(rawQuery)` via `applyListQuery`
      with `allowedSortFields: ["id", "userId", "publishedAt", "createdAt"]` and an optional `userId`
      filter; `getPostById(id)` throwing `HttpError(404, "RESOURCE_NOT_FOUND", ...)` on a miss.
- [X] T015 [US1] Implement `src/controllers/post.controller.ts`: `listPosts`, `getPostById` handlers;
      parse `:id` via `src/utils/uuidParam.ts` (T004).
- [X] T016 [US1] Implement `src/routes/post.routes.ts` mounting `GET /api/v1/posts`,
      `GET /api/v1/posts/:id`, with `.all()` → `methodNotAllowedHandler` on both paths; mount
      `postRouter` on `apiRouter` in `src/app.ts`.
- [X] T017 [US1] Create the seed generator `src/data/posts.seed.ts`: generate at least 100 `Post`
      records, `id` via `crypto.randomUUID()`, `userId` cycling deterministically through the seeded
      users (so every seeded user authors at least one post where the count allows), index-derived
      `title`/`body`, populated into the T002 store; generated after `users.seed.ts` so every `userId`
      resolves (FR-002, FR-003).
- [X] T018 [P] [US1] Write `tests/posts.test.ts`: `GET /api/v1/posts` → `pagination.total >= 100`;
      `GET /api/v1/posts/{id}` for a known seeded id → `200`; well-formed-but-unknown UUID → `404`;
      malformed UUID → `400`; `POST`/`PUT`/`PATCH`/`DELETE` on `/api/v1/posts` and
      `/api/v1/posts/{id}` → `405`.

### Comments

- [X] T019 [P] [US1] Create the Comment model in `src/models/comment.ts`: `Comment` type — `id`
      (integer, server-assigned, immutable), `postId` (string UUID, references an existing `Post.id`),
      `userId` (integer, references an existing `User.id`), `body` (string, 1–1000 chars), `createdAt`
      (ISO 8601 string, server-assigned). No write schema yet — `CommentCreate` is added in User Story 2
      (data-model.md).
- [X] T020 [US1] Implement `src/services/comment.service.ts`: `listComments(rawQuery)` via
      `applyListQuery` with `allowedSortFields: ["id", "postId", "userId", "createdAt"]` and an
      optional `postId` filter; `getCommentById(id)` throwing `HttpError(404, "RESOURCE_NOT_FOUND",
      ...)` on a miss; backed by the existing numeric `createInMemoryStore<Comment>()` (T003 from Spec
      002, unchanged).
- [X] T021 [US1] Implement `src/controllers/comment.controller.ts`: `listComments`, `getCommentById`
      handlers; parse `:id` via the existing `src/utils/idParam.ts`.
- [X] T022 [US1] Implement `src/routes/comment.routes.ts` mounting `GET /api/v1/comments`,
      `GET /api/v1/comments/:id`, with `.all()` → `methodNotAllowedHandler` on both paths; mount
      `commentRouter` on `apiRouter` in `src/app.ts`.
- [X] T023 [US1] Create the seed generator `src/data/comments.seed.ts`: generate at least 200 `Comment`
      records, numeric ids via the store's auto-increment, `postId`/`userId` cycling deterministically
      through seeded posts/users, index-derived `body`; generated after `posts.seed.ts` and
      `users.seed.ts` so every reference resolves (FR-002, FR-003).
- [X] T024 [P] [US1] Write `tests/comments.test.ts`: `GET /api/v1/comments` →
      `pagination.total >= 200`; `GET /api/v1/comments/{id}` for a known seeded id → `200`;
      valid-but-nonexistent numeric id → `404`; malformed/negative/zero/huge id → `400`;
      `POST`/`PUT`/`PATCH`/`DELETE` on `/api/v1/comments` and `/api/v1/comments/{id}` → `405`.

### Reviews

- [X] T025 [P] [US1] Create the Review model in `src/models/review.ts`: `Review` type — `id` (integer,
      server-assigned, immutable), `productId` (integer, references an existing `Product.id`), `userId`
      (integer, references an existing `User.id`), `rating` (integer, 1–5 inclusive), `body` (string,
      0–1000 chars, defaults to `""`), `createdAt` (ISO 8601 string, server-assigned). No write schema —
      this resource has no write path in this feature (data-model.md, Clarifications).
- [X] T026 [US1] Implement `src/services/review.service.ts`: `listReviews(rawQuery)` via
      `applyListQuery` with `allowedSortFields: ["id", "productId", "rating", "createdAt"]` and an
      optional `productId` filter; `getReviewById(id)` throwing `HttpError(404, "RESOURCE_NOT_FOUND",
      ...)` on a miss.
- [X] T027 [US1] Implement `src/controllers/review.controller.ts`: `listReviews`, `getReviewById`
      handlers; parse `:id` via the existing `src/utils/idParam.ts`.
- [X] T028 [US1] Implement `src/routes/review.routes.ts` mounting `GET /api/v1/reviews`,
      `GET /api/v1/reviews/:id`, with `.all()` → `methodNotAllowedHandler` on both paths; mount
      `reviewRouter` on `apiRouter` in `src/app.ts`.
- [X] T029 [US1] Create the seed generator `src/data/reviews.seed.ts`: generate at least 100 `Review`
      records across a representative subset of seeded products, `rating` cycling deterministically
      through 1–5 (so every rating value has seed data), `userId` cycling through seeded users;
      generated after `products.seed.ts` and `users.seed.ts` (FR-002, FR-003).
- [X] T030 [P] [US1] Write `tests/reviews.test.ts`: `GET /api/v1/reviews` →
      `pagination.total >= 100`; `GET /api/v1/reviews/{id}` for a known seeded id → `200`;
      valid-but-nonexistent numeric id → `404`; malformed/negative/zero/huge id → `400`;
      `POST`/`PUT`/`PATCH`/`DELETE` on `/api/v1/reviews` and `/api/v1/reviews/{id}` → `405`.

### Payments

- [X] T031 [P] [US1] Create the Payment model in `src/models/payment.ts`: `Payment` type — `id`
      (string UUID, server-assigned, immutable), `orderId` (integer, references an existing
      `Order.id`), `amount` (number, >= 0), `status` (one of `pending`, `completed`, `failed`,
      `refunded` — from `src/models/enums.ts`'s `PAYMENT_STATUSES`, T001), `processedAt` (string,
      calendar date `YYYY-MM-DD`), `createdAt` (ISO 8601 string, server-assigned). No write schema —
      this resource has no write path in this feature (data-model.md, Clarifications).
- [X] T032 [US1] Implement `src/services/payment.service.ts`: `listPayments(rawQuery)` via
      `applyListQuery` with `allowedSortFields: ["id", "orderId", "status", "processedAt",
      "createdAt"]` and an optional `status` filter; `getPaymentById(id)` throwing
      `HttpError(404, "RESOURCE_NOT_FOUND", ...)` on a miss.
- [X] T033 [US1] Implement `src/controllers/payment.controller.ts`: `listPayments`, `getPaymentById`
      handlers; parse `:id` via `src/utils/uuidParam.ts` (T004).
- [X] T034 [US1] Implement `src/routes/payment.routes.ts` mounting `GET /api/v1/payments`,
      `GET /api/v1/payments/:id`, with `.all()` → `methodNotAllowedHandler` on both paths; mount
      `paymentRouter` on `apiRouter` in `src/app.ts`.
- [X] T035 [US1] Create the seed generator `src/data/payments.seed.ts`: generate exactly one `Payment`
      per seeded order (`orderId` = each order's id, `amount` = that order's `total`), `id` via
      `crypto.randomUUID()`, `status` cycling deterministically through all four `PAYMENT_STATUSES`
      values, `processedAt` a deterministic spread of calendar dates; generated after `orders.seed.ts`
      (FR-002, FR-003).
- [X] T036 [P] [US1] Write `tests/payments.test.ts`: `GET /api/v1/payments` →
      `pagination.total` equal to the seeded order count; `GET /api/v1/payments/{id}` for a known
      seeded id → `200`; well-formed-but-unknown UUID → `404`; malformed UUID → `400`;
      `POST`/`PUT`/`PATCH`/`DELETE` on `/api/v1/payments` and `/api/v1/payments/{id}` → `405`.

### Wiring

- [X] T037 [US1] Extend `tests/helpers/resetStores.ts` to also call `seedCategories()`,
      `seedPosts()`, `seedComments()`, `seedReviews()`, `seedPayments()` after the existing four calls,
      in dependency order (categories independent; posts needs users; comments needs posts and users;
      reviews needs products and users; payments needs orders) — depends on T011, T017, T023, T029,
      T035.

**Checkpoint**: User Story 1 complete — all five new resources are independently browsable against
deterministic seed data. This is the MVP.

---

## Phase 4: User Story 2 - Traverse Parent-Child Relationships (Priority: P2)

**Goal**: Six nested/derived routes connecting the new and Spec 002 resources, including two nested
`POST` endpoints, with a `404` on a nonexistent parent (checked before the child collection) and a
`200` + empty list on a childless-but-existing parent.

**Independent Test**: Request each nested route with known seeded parent identifiers and confirm the
returned children match exactly; create a post/comment through a nested `POST` and confirm it
immediately appears in both the nested and top-level listings; confirm a nonexistent parent id
returns `404` on every nested route.

### Users → Orders

- [X] T038 [US2] Add `listOrdersForUser(userId, rawQuery)` to `src/services/order.service.ts`:
      validate the user exists via the user store, throwing `HttpError(404, "RESOURCE_NOT_FOUND",
      ...)` first if not; then resolve customers whose `userId` matches, then orders whose
      `customerId` is among those customers, returned via `applyListQuery` (empty paginated set, not
      `404`, if the user has no linked customers/orders) (FR-009, FR-015).
- [X] T039 [US2] Add a `getOrdersForUser` handler to `src/controllers/order.controller.ts`
      (parsing `:id` via the existing `idParam.ts`) and mount `GET /api/v1/users/:id/orders` in
      `src/routes/order.routes.ts`.

### Orders → Products

- [X] T040 [US2] Add `listProductsForOrder(orderId, rawQuery)` to `src/services/order.service.ts`:
      validate the order exists first (`404` if not), then return the distinct products referenced by
      `order.items[].productId` via the product store, via `applyListQuery` (FR-014, FR-015).
- [X] T041 [US2] Add a `getProductsForOrder` handler to `src/controllers/order.controller.ts` and
      mount `GET /api/v1/orders/:id/products` in `src/routes/order.routes.ts`.

### Users → Posts

- [X] T042 [P] [US2] Add `PostCreate` to `src/models/post.ts`: a `.strict()` zod schema — `title`
      (string, 1–200 chars, required), `body` (string, 1–5000 chars, required); no `userId` field, so
      it can never be accepted from the request body (data-model.md, FR-018).
- [X] T043 [US2] Add `listPostsForUser(userId, rawQuery)` and `createPostForUser(userId, rawBody)` to
      `src/services/post.service.ts`: both validate the user exists first (`404` if not); create
      parses the body against `PostCreate` (T042), sets `userId` from the URL parameter, generates
      `id` via `crypto.randomUUID()`, and sets `publishedAt`/`createdAt`/`updatedAt` (FR-010, FR-015,
      FR-018).
- [X] T044 [US2] Add `listPostsForUser`/`createPostForUser` handlers to
      `src/controllers/post.controller.ts` (parsing the user `:id` via the existing `idParam.ts`) and
      mount `GET`/`POST /api/v1/users/:id/posts` in `src/routes/post.routes.ts`.

### Posts → Comments

- [X] T045 [P] [US2] Add `CommentCreate` to `src/models/comment.ts`: a `.strict()` zod schema —
      `userId` (integer, required), `body` (string, 1–1000 chars, required); no `postId` field, so it
      can never be accepted from the request body (data-model.md, FR-018).
- [X] T046 [US2] Add `listCommentsForPost(postId, rawQuery)` and `createCommentForPost(postId,
      rawBody)` to `src/services/comment.service.ts`: both validate the post exists first (`404` if
      not); create parses the body against `CommentCreate` (T045), validates `userId` resolves against
      the user store — rejecting with `HttpError(400, "VALIDATION_ERROR", ...)` naming `userId` if it
      is missing or unknown — sets `postId` from the URL parameter, and generates a numeric id via the
      existing `createInMemoryStore` (FR-011, FR-015, FR-018).
- [X] T047 [US2] Add `listCommentsForPost`/`createCommentForPost` handlers to
      `src/controllers/comment.controller.ts` (parsing the post `:id` via `src/utils/uuidParam.ts`,
      T004) and mount `GET`/`POST /api/v1/posts/:id/comments` in `src/routes/comment.routes.ts`.

### Products → Reviews

- [X] T048 [US2] Add `listReviewsForProduct(productId, rawQuery)` to
      `src/services/review.service.ts`: validate the product exists first (`404` if not), then return
      its reviews via `applyListQuery` (FR-012, FR-015).
- [X] T049 [US2] Add a `listReviewsForProduct` handler to `src/controllers/review.controller.ts`
      (parsing the product `:id` via the existing `idParam.ts`) and mount
      `GET /api/v1/products/:id/reviews` in `src/routes/review.routes.ts`.

### Products → Category

- [X] T050 [US2] Add `getCategoryForProduct(productId)` to `src/services/category.service.ts`:
      validate the product exists first (`404` if not), look up its `category` string, and return the
      matching Category record (`404` in the defensive case it does not resolve, though the T011 seed
      guarantees it always does) (FR-013, FR-015).
- [X] T051 [US2] Add a `getCategoryForProduct` handler to `src/controllers/category.controller.ts`
      (parsing the product `:id` via the existing `idParam.ts`) and mount
      `GET /api/v1/products/:id/category` in `src/routes/category.routes.ts`.

### Tests

- [X] T052 [P] [US2] Add nested-route tests to `tests/orders.test.ts`: `GET /api/v1/users/{id}/orders`
      for a known user with linked orders → `200` with exactly the matching orders; a user with no
      linked customers/orders → `200` + empty `data`; nonexistent user id → `404`;
      `GET /api/v1/orders/{id}/products` for a known order → `200` with its distinct products;
      nonexistent order id → `404`.
- [X] T053 [P] [US2] Add nested-route tests to `tests/posts.test.ts`: `GET /api/v1/users/{id}/posts`
      for a known user → `200` with exactly that user's posts; nonexistent user → `404`; a user with no
      posts → `200` + empty `data`; `POST /api/v1/users/{id}/posts` with a valid body → `201`, the new
      post appears in both `GET /api/v1/posts` and the nested listing immediately (SC-003); an invalid
      body (missing `title`/`body`, unexpected field) → `400`/`422`; a `userId` supplied in the body is
      ignored in favor of the URL's user id; nonexistent user → `404` on the `POST` too.
- [X] T054 [P] [US2] Add nested-route tests to `tests/comments.test.ts`:
      `GET /api/v1/posts/{id}/comments` for a known post → `200` with exactly that post's comments;
      nonexistent post → `404`; a post with no comments → `200` + empty `data`;
      `POST /api/v1/posts/{id}/comments` with a valid body → `201`, appears in both listings
      immediately; missing/invalid `userId` (including one that does not resolve to an existing user)
      → `400`/`422`; a `postId` supplied in the body is ignored in favor of the URL's post id;
      nonexistent post → `404` on the `POST` too.
- [X] T055 [P] [US2] Add nested-route tests to `tests/reviews.test.ts`:
      `GET /api/v1/products/{id}/reviews` for a known product → `200` with exactly that product's
      reviews; nonexistent product → `404`; a product with no reviews → `200` + empty `data`.
- [X] T056 [P] [US2] Add nested-route tests to `tests/categories.test.ts`:
      `GET /api/v1/products/{id}/category` for a known product → `200` with the matching Category
      record; nonexistent product → `404`.

**Checkpoint**: User Stories 1 and 2 both work — the catalog is browsable and its relationships to
Spec 002's resources are fully navigable.

---

## Phase 5: User Story 3 - Path Parameter Type Diversity (Priority: P3)

**Goal**: The two dedicated diversity endpoints (`payments/by-date/{date}`,
`reviews/by-rating/{rating}`) exist and validate correctly, and every new identifier format (slug,
UUID, date, enum/rating) is exercised by a full edge-case matrix, not just the basic cases already
covered in User Story 1.

**Independent Test**: Call the slug/UUID/date/enum-keyed endpoints with valid, missing, malformed, and
empty identifiers and confirm each returns the correct `200`/`400`/`404` outcome.

- [X] T057 [US3] Add `listPaymentsByDate(date, rawQuery)` to `src/services/payment.service.ts`:
      filters payments where `processedAt === date`, returned via `applyListQuery` (FR-007).
- [X] T058 [US3] Add a `listPaymentsByDate` handler to `src/controllers/payment.controller.ts`
      (parsing `:date` via `src/utils/dateParam.ts`, T005) and mount
      `GET /api/v1/payments/by-date/:date` in `src/routes/payment.routes.ts`.
- [X] T059 [US3] Add `listReviewsByRating(rating, rawQuery)` to `src/services/review.service.ts`:
      filters reviews where `rating` equals the given value, returned via `applyListQuery` (FR-008).
- [X] T060 [US3] Add a `listReviewsByRating` handler to `src/controllers/review.controller.ts`
      (parsing `:rating` via `src/utils/ratingParam.ts`, T006) and mount
      `GET /api/v1/reviews/by-rating/:rating` in `src/routes/review.routes.ts`.
- [X] T061 [P] [US3] Add to `tests/payments.test.ts`: `GET /api/v1/payments/by-date/{date}` for a date
      with seeded payments → `200` with only matching records; a date with none → `200` + empty
      `data`; malformed format (`not-a-date`) → `400`; invalid calendar date (`2026-13-01`,
      `2026-02-30`) → `400`; plus additional UUID-format edge cases on the top-level payment id
      (wrong-length string, missing hyphens, non-hex characters, empty segment) → `400`.
- [X] T062 [P] [US3] Add to `tests/reviews.test.ts`: `GET /api/v1/reviews/by-rating/{rating}` for each
      of ratings 1–5 → `200` with only matching records; `0`, `6`, `3.5`, and `abc` → `400`.
- [X] T063 [P] [US3] Add additional slug-format edge-case tests to `tests/categories.test.ts`:
      uppercase letters, underscores, a leading/trailing hyphen, and a double hyphen → `400`; an empty
      slug segment → `404` (falls through to the app-level not-found handler, consistent with Spec
      002's trailing-slash convention), never `500`.
- [X] T064 [P] [US3] Add additional UUID-format edge-case tests to `tests/posts.test.ts`: wrong-length
      string, missing hyphens, non-hex characters, and empty segment → `400`, never `500`.

**Checkpoint**: User Stories 1–3 all work — every identifier format this spec introduces is fully
validated.

---

## Phase 6: User Story 4 - Cross-Resource Search (Priority: P4)

**Goal**: `GET /api/v1/search?q=` returns normalized, paginated hits across users, customers,
products, categories, posts, comments, and reviews, and handles every documented edge case.

**Independent Test**: Issue `GET /api/v1/search?q=` with a matrix of query values (matching term,
empty, missing, no-match, special characters, long string, case variant) and confirm each returns the
documented status and shape.

- [X] T065 [P] [US4] Create `src/models/searchResult.ts`: `SearchResult` type — `resourceType` (enum
      `user` \| `customer` \| `product` \| `category` \| `post` \| `comment` \| `review`), `id` (string
      or integer), `label` (string), `snippet` (string, optional) (data-model.md).
- [X] T066 [US4] Implement `src/services/search.service.ts`: `search(rawQuery)` — throws
      `HttpError(400, "VALIDATION_ERROR", ...)` naming `q` as required when `q` is missing or an empty
      string (FR-021); otherwise scans the user/customer/product/category/post/comment/review stores,
      matches `q` case-insensitively as a substring against each resource's name/title/description-style
      field(s), builds `SearchResult` entries (T065), and paginates the combined array via
      `applyListQuery` (`page`/`limit` only — no `sort`) (FR-020, FR-022, FR-023).
- [X] T067 [US4] Implement `src/controllers/search.controller.ts` (`search` handler) and
      `src/routes/search.routes.ts` mounting `GET /api/v1/search` with `.all()` →
      `methodNotAllowedHandler`; mount `searchRouter` on `apiRouter` in `src/app.ts`.
- [X] T068 [P] [US4] Write `tests/search.test.ts`: a term matching one or more resources → `200` with
      each hit's `resourceType` set correctly; missing `q` → `400`; empty `q` (`?q=`) → `400`; a term
      with no matches → `200` + empty `data` (not `404`); special characters (e.g. `%$#`) and an
      excessively long string → `200`, never a crash; a term differing only in case from a known match
      → identical results to the exact-case query.

**Checkpoint**: All four user stories are independently functional and tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification across all four user stories.

- [X] T069 [P] Merge `contracts/catalog-nested-search.openapi.yaml`'s `tags`, `paths`, and
      `components.schemas`/`components.parameters` into the root `openapi.yaml`, so `/docs`,
      `/openapi.json`, and `/openapi.yaml` document exactly the endpoints this spec implements
      (constitution: Quality Gates & Spec Parity).
- [X] T070 [P] Add an `X-Request-ID` presence assertion to one representative test in each of
      `tests/categories.test.ts`, `tests/posts.test.ts`, `tests/comments.test.ts`,
      `tests/reviews.test.ts`, `tests/payments.test.ts`, and `tests/search.test.ts`, confirming FR-025
      holds for this spec's endpoints too.
- [X] T071 Run `npm test` and confirm the full suite — Specs 001/002's existing tests plus this
      spec's new and extended test files — passes.
- [X] T072 Execute the manual validation scenarios in
      `specs/003-catalog-nested-search/quickstart.md` against a running `npm run dev` server and
      confirm every expected status code and behavior.
- [X] T073 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 21 new
      operations correctly, with no schema errors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Delivers the five read-only
  resources every later story extends.
- **User Story 2 (Phase 4)**: Depends on **User Story 1** being complete for the five new resources'
  stores/services to extend, and on Spec 002's `order`/`user`/`product` resources already existing.
- **User Story 3 (Phase 5)**: Depends on **User Story 1** (Payment/Review resources must exist).
  Independent of User Story 2 — may proceed in parallel with it once US1 is done.
- **User Story 4 (Phase 6)**: Depends on **User Story 1** (all seven scanned stores must exist).
  Independent of User Stories 2 and 3 — may proceed in parallel with either once US1 is done.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- US1: within each resource sub-group, model → service → controller → routes (+ `app.ts` wiring) →
  seed → tests, in that order; the five resources can be built in parallel by different contributors,
  except **comments must be seeded after posts** (T023 depends on T017) and **payments must be seeded
  after Spec 002's orders** (T035 depends on the existing `orders.seed.ts`); the resetStores wiring
  task (T037) depends on all five seed tasks.
- US2: each of the six relationships (schema if needed → service → controller+routes) is largely
  independent of the others, except **Users→Orders and Orders→Products both edit
  `src/services/order.service.ts`/`order.controller.ts`/`order.routes.ts`** (T038–T041 in sequence,
  not parallel with each other). Test tasks (T052–T056) each touch a different file and depend only on
  their own relationship's implementation tasks being done.
- US3: the two diversity endpoints (T057–T060) are independent of each other; test tasks (T061–T064)
  depend on the corresponding implementation tasks and on User Story 1's basic id-handling tests
  already existing.
- US4: T065 (model) blocks T066 (service), which blocks T067 (controller/routes); T068 (tests) depends
  on T067.

### Parallel Opportunities

- T002–T006 (Foundational) all run in parallel.
- Within US1, the five resources' model-creation tasks (T007, T013, T019, T025, T031) run in parallel;
  each resource's test task (T012, T018, T024, T030, T036) runs in parallel with the others.
- Within US2, T042 and T045 (the two new zod schemas) run in parallel with each other and with the
  Users→Orders/Orders→Products/Products→Reviews/Products→Category service tasks (different files);
  T052–T056 (one test file per relationship-group) all run in parallel once their implementation tasks
  are done.
- Within US3, T061–T064 (one test file each) all run in parallel.
- T069, T070, and T073 (Polish) run in parallel; T071 and T072 are sequential whole-suite checks.

---

## Parallel Example: User Story 1

```bash
# Launch all five resources' model-creation tasks together:
Task: "Create the Category model in src/models/category.ts"
Task: "Create the Post model in src/models/post.ts"
Task: "Create the Comment model in src/models/comment.ts"
Task: "Create the Review model in src/models/review.ts"
Task: "Create the Payment model in src/models/payment.ts"

# Once each resource's own routes + seed are wired, launch all five read-only test tasks together:
Task: "Write tests/categories.test.ts"
Task: "Write tests/posts.test.ts"
Task: "Write tests/comments.test.ts"
Task: "Write tests/reviews.test.ts"
Task: "Write tests/payments.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (all five resources, read-only + seed data).
4. **STOP and VALIDATE**: run the User Story 1 section of `quickstart.md` independently.
5. This is a usable MVP: automated testing tools already have a full read-only catalog target.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate independently → MVP.
3. User Story 2 → validate independently → relational navigation lands.
4. User Story 3 → validate independently → path-parameter-diversity coverage lands.
5. User Story 4 → validate independently → cross-resource search lands.
6. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple contributors: complete Setup + Foundational together; one contributor per resource
inside User Story 1 (categories/posts/comments/reviews/payments), noting comments' seed depends on
posts' seed and payments' seed depends on Spec 002's orders; once User Story 1 is merged, one
contributor per remaining story (US2/US3/US4) in parallel, since each touches a distinct set of
endpoints.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- Every nested/derived route's parent-existence check is the primary mechanism satisfying FR-015; test
  tasks (US2) verify it, they do not re-implement it.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies that
  would break a later story's ability to be demoed on its own once User Story 1 exists.
