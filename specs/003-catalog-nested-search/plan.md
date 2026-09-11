# Implementation Plan: Read-Only Catalog & Nested Resources + Search

**Branch**: `003-catalog-nested-search` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-catalog-nested-search/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver five read-only catalog resources — categories, posts, comments, reviews, payments — with
deterministic seed data (≥20 categories, ≥100 posts, ≥200 comments, ≥100 reviews, one payment per
seeded order), six nested/derived routes connecting them to the Spec 002 resources
(`users/:id/orders`, `users/:id/posts` with nested `POST`, `posts/:id/comments` with nested `POST`,
`products/:id/reviews`, `products/:id/category`, `orders/:id/products`), two dedicated endpoints closing
the date/enum path-parameter-type gap (`payments/by-date/{date}`, `reviews/by-rating/{rating}`), and a
cross-resource `GET /api/v1/search` returning normalized, paginated hits. Technical approach: a new
string-keyed store factory alongside Spec 002's numeric one (slugs for categories, UUIDs for posts/
payments), the existing `applyListQuery` pipeline reused unchanged for every list/nested-list/search
response, and the same synchronous cross-reference-validation pattern Spec 002 established for
`Comment.userId`/`Post.userId`/`Review.userId`/`Payment.orderId` (see [research.md](research.md) for
rationale on each).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001–002

**Primary Dependencies**: Express 4.x, `zod` (bodies for the two nested-`POST` endpoints) — no new
dependencies; UUIDs use Node's built-in `crypto.randomUUID()`

**Storage**: N/A — in-memory only; the existing numeric `createInMemoryStore<T>()` (Spec 002, reused
unchanged for Comment/Review) plus a new string-keyed `createKeyedStore<T extends {id: string}>()`
(Category, Post, Payment), seeded deterministically at startup

**Testing**: Vitest + Supertest — unchanged from Specs 001–002

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for
external testing tools (k6, Postman, contract-test suites)

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged from Specs
001–002

**Performance Goals**: List/get/nested-list/search on the seeded volumes (100–200+ records per new
resource) respond in low tens of milliseconds under normal load; all operations are O(n) in-memory
array/map scans with no external calls — search is the widest scan (across seven resource stores) but
still bounded by total seeded record counts (a few hundred), well within the constitution's
bounded-resource principle

**Constraints**: No unbounded memory/CPU per request; no external network calls; deterministic seed
data and behavior across restarts (constitution Principle II, NON-NEGOTIABLE); every new identifier
format (slug, UUID) immutable once assigned; cross-resource references (`Post.userId`,
`Comment.postId`/`Comment.userId`, `Review.productId`/`Review.userId`, `Payment.orderId`) validated
synchronously against existing in-memory stores; nested routes MUST return `404` for a nonexistent
parent before evaluating the child collection, distinct from `200` + empty data for a childless parent

**Scale/Scope**: This spec only — five read-only resources, six nested/derived routes, two
path-parameter-diversity endpoints, and cross-resource search; write access beyond the two nested
`POST` endpoints, authentication, and the idempotent `POST /payments` endpoint are explicitly out of
scope (later specs per the project roadmap)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds read-only catalog surface, six relational-navigation routes, and search — pure surface expansion (int/UUID/slug/date/enum path-parameter diversity, nested-write validation, cross-resource search), nothing narrowed. |
| II. Determinism & Reproducibility | PASS | All seed generators are pure, index-derived functions (research.md); no randomness in "normal" behavior — `crypto.randomUUID()` is used only for id assignment, never as a source of varying *behavior*, and every id, once generated at startup, is stable for the life of the process; identical requests against a fresh server always return identical results. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every new path-parameter format (slug/UUID/date/enum) validated by a dedicated parse-or-throw utility before any store lookup; nested `POST` bodies validated by `.strict()` `zod` schemas; every response reuses the existing `ErrorEnvelope`/`PaginationEnvelope`/`X-Request-ID` middleware unchanged. |
| IV. Secret & Credential Hygiene | PASS | This spec introduces no secrets, tokens, or credentials — none of the five new resources carry authentication material. |
| V. Bounded Resource Usage Under Load | PASS | All operations, including search, are O(n) in-memory reads over seeded collections (at most a few hundred records total); no external calls, no unbounded allocation, no per-request expensive computation. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New files follow the existing `routes/controllers/services/models/data` split; all new routes mount under the existing `config.apiPrefix`-scoped router; nested/derived routes are added to the domain files that own the store they read/write, matching Spec 002's existing convention (research.md). |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly the paths/schemas in `contracts/catalog-nested-search.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-catalog-nested-search/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app.ts                          # existing; gains 6 new resource routers mounted on apiRouter (order.routes.ts is extended in place, no new mount needed)
├── data/
│   ├── inMemoryStore.ts             # existing (Spec 002), unchanged — reused for Comment/Review
│   ├── keyedStore.ts                # NEW: createKeyedStore<T extends {id: string}>() for slug/UUID-keyed resources
│   ├── categories.seed.ts           # NEW: 10 ProductCategory-matching slugs + >=10 catalog-only categories
│   ├── posts.seed.ts                # NEW: >=100 posts, authored by seeded users, UUID ids
│   ├── comments.seed.ts             # NEW: >=200 comments, distributed across seeded posts, numeric ids
│   ├── reviews.seed.ts              # NEW: >=100 reviews across a product subset, ratings 1-5 cyclic
│   └── payments.seed.ts             # NEW: one payment per seeded order, UUID ids, status/date cyclic
├── models/
│   ├── enums.ts                     # existing; gains PAYMENT_STATUSES
│   ├── category.ts                  # NEW: Category type (no write schema — no write path)
│   ├── post.ts                      # NEW: Post type + PostCreate zod schema (title, body only)
│   ├── comment.ts                   # NEW: Comment type + CommentCreate zod schema (userId, body)
│   ├── review.ts                    # NEW: Review type (no write schema)
│   ├── payment.ts                   # NEW: Payment type (no write schema)
│   └── searchResult.ts              # NEW: SearchResult type (resourceType/id/label/snippet)
├── services/
│   ├── listQuery.service.ts         # existing (Spec 002), unchanged — reused for every new list/nested-list
│   ├── category.service.ts          # NEW: list/get by slug; getCategoryForProduct(productId)
│   ├── post.service.ts              # NEW: list/get by id; listPostsForUser/createPostForUser (validates parent user)
│   ├── comment.service.ts           # NEW: list/get by id; listCommentsForPost/createCommentForPost (validates parent post + userId)
│   ├── review.service.ts            # NEW: list/get by id; listReviewsForProduct; listReviewsByRating
│   ├── payment.service.ts           # NEW: list/get by id; listPaymentsByDate
│   ├── search.service.ts            # NEW: scans user/customer/product/category/post/comment/review stores, builds SearchResult[]
│   ├── user.service.ts              # existing; UNCHANGED — /users/:id/... nested routes are owned by the child resource's own service, not user.service.ts
│   └── order.service.ts             # existing; gains listOrdersForUser (customer.userId join, backs /users/:id/orders) + listProductsForOrder (backs /orders/:id/products)
├── controllers/
│   ├── category.controller.ts       # NEW: also backs /api/v1/products/:id/category
│   ├── post.controller.ts           # NEW: also backs /api/v1/users/:id/posts
│   ├── comment.controller.ts        # NEW: also backs /api/v1/posts/:id/comments
│   ├── review.controller.ts         # NEW: also backs /api/v1/products/:id/reviews
│   ├── payment.controller.ts        # NEW
│   ├── search.controller.ts         # NEW
│   ├── user.controller.ts           # existing; UNCHANGED
│   └── order.controller.ts          # existing; gains getOrdersForUser (backs /users/:id/orders) + getProductsForOrder (backs /orders/:id/products) handlers
├── routes/
│   ├── category.routes.ts           # NEW: /api/v1/categories, /api/v1/categories/:slug, /api/v1/products/:id/category
│   ├── post.routes.ts               # NEW: /api/v1/posts, /api/v1/posts/:id, /api/v1/users/:id/posts (GET+POST)
│   ├── comment.routes.ts            # NEW: /api/v1/comments, /api/v1/comments/:id, /api/v1/posts/:id/comments (GET+POST)
│   ├── review.routes.ts             # NEW: /api/v1/reviews, /api/v1/reviews/:id, /api/v1/reviews/by-rating/:rating, /api/v1/products/:id/reviews
│   ├── payment.routes.ts            # NEW: /api/v1/payments, /api/v1/payments/:id, /api/v1/payments/by-date/:date
│   ├── search.routes.ts             # NEW: /api/v1/search
│   ├── user.routes.ts               # existing; UNCHANGED — no nested routes registered here (see Structure Decision)
│   ├── product.routes.ts            # existing; UNCHANGED — no nested routes registered here (see Structure Decision)
│   └── order.routes.ts              # existing; gains /api/v1/users/:id/orders and /api/v1/orders/:id/products
└── utils/
    ├── idParam.ts                   # existing (Spec 002), unchanged — reused for Comment/Review ids
    ├── slugParam.ts                 # NEW: category slug parse-or-400
    ├── uuidParam.ts                 # NEW: post/payment UUID parse-or-400
    ├── dateParam.ts                 # NEW: calendar-date parse-or-400 (rejects invalid dates, not just format)
    └── ratingParam.ts               # NEW: 1-5 integer parse-or-400

tests/
├── categories.test.ts                # NEW: list/get/404/400 + products/:id/category
├── posts.test.ts                     # NEW: list/get/404/400 + users/:id/posts (GET+POST, incl. 404 on missing user)
├── comments.test.ts                   # NEW: list/get/404/400 + posts/:id/comments (GET+POST, incl. userId cross-ref 400)
├── reviews.test.ts                    # NEW: list/get/404/400 + products/:id/reviews + reviews/by-rating/:rating
├── payments.test.ts                   # NEW: list/get/404/400 + payments/by-date/:date
├── search.test.ts                     # NEW: full edge-case matrix (missing/empty/no-match/special-char/long/case)
├── users.test.ts                      # existing; UNCHANGED
└── orders.test.ts                     # existing; gains users/:id/orders + orders/:id/products cases (both live in order.routes.ts)

openapi.yaml                          # existing; gains the paths/schemas from contracts/catalog-nested-search.openapi.yaml
```

**Structure Decision**: Extends the existing Spec 001/002 single-backend-project layout — no new
top-level directories. Every route — nested or not — is registered by the router file that owns the
store the route reads or writes, regardless of which resource's URL segment introduces it (research.md).
Express routers don't care which file registers which path string, so `/api/v1/users/{id}/posts`
is registered in `post.routes.ts` (it reads/writes the Post store), `/api/v1/users/{id}/orders` and
`/api/v1/orders/{id}/products` stay in the existing `order.routes.ts` (both read the Order store),
`/api/v1/posts/{id}/comments` is registered in `comment.routes.ts`, `/api/v1/products/{id}/reviews` in
`review.routes.ts`, and `/api/v1/products/{id}/category` in `category.routes.ts`. Consequently
`user.routes.ts` and `product.routes.ts` are unchanged by this spec even though new routes share their
URL prefix — this avoids splitting a single resource's validation and store access across multiple
files, the drift risk research.md calls out.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS: `data-model.md` introduces no
secrets or external calls, keeps exactly one error/pagination envelope (reused, not redefined), and
fixes concrete enums/bounds (`PaymentStatus`, `Review.rating` 1–5) so validation and the two
diversity endpoints (`payments/by-date`, `reviews/by-rating`) are deterministic and testable per
Principle II. The Category/Product seed reconciliation (research.md) resolves the ≥20-category
requirement without touching Spec 002's shipped `ProductCategory` enum, keeping this spec's blast
radius contained to its own new files plus a small, additive extension to `order.*` only.
`contracts/catalog-nested-search.openapi.yaml` documents exactly the 21 operations this spec
implements (12 top-level catalog operations, 8 nested/derived operations — including the 2 nested
`POST`s — and 1 search operation), reusing the root document's `Error`/`Pagination`/`Page`/`Limit`/
`Sort`/`*IdParam` components rather than duplicating them. The quickstart's seed-volume,
nested-navigation (including parent-not-found vs. empty-children), path-parameter-diversity, and
search-edge-case scenarios directly exercise Principles II, III, and V. No new violations introduced
during design; Complexity Tracking remains empty.
