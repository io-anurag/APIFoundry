# Phase 1 Data Model: Read-Only Catalog & Nested Resources + Search

**Feature**: `003-catalog-nested-search` | **Date**: 2026-09-12

Five new resources, each read-only at the top level (`POST`/`PUT`/`PATCH`/`DELETE` return `405`), except
where Posts and Comments gain a nested `POST`. Enum values and identifier formats below are fixed by the
Clarifications session in [spec.md](spec.md) and the identifier-scheme decisions in
[research.md](research.md).

## Category

| Field | Type | Notes |
|---|---|---|
| `id` | string (slug), e.g. `electronics` | Immutable; derived from `name` at seed time, never accepted from a request (no write path exists) |
| `name` | string, 1–100 chars | Display name |
| `description` | string, 0–500 chars | Optional, defaults to `""` |
| `createdAt` | ISO 8601 string, server-assigned | |

**Seed volume**: ≥20 records — exactly the 10 `ProductCategory` enum values from Spec 002 (so every
seeded product's `category` resolves via `products/:id/category`), plus ≥10 additional catalog-only
categories not referenced by any seeded product (research.md).

**Validation rules**: none on write (no write path); slug format enforced on the `id` path parameter by
`src/utils/slugParam.ts` for `GET /api/v1/categories/{slug}`.

## Post

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID), server-assigned | Immutable; generated with `crypto.randomUUID()` |
| `userId` | integer | Required; MUST reference an existing `User.id`; author of the post — set from the URL's parent user id on nested create, never from the request body |
| `title` | string, 1–200 chars | Required |
| `body` | string, 1–5000 chars | Required |
| `publishedAt` | ISO 8601 date-time string, server-assigned | Set on create |
| `createdAt` / `updatedAt` | ISO 8601 string, server-assigned | |

**Seed volume**: ≥100 records, authored by seeded users (cyclically distributed so every seeded user has
at least one post where the seed count allows).

**Validation rules**: `POST /api/v1/users/{id}/posts` validates `title`/`body` via a `.strict()` `zod`
schema (`PostCreate`: `title`, `body` only — `userId` is never accepted in the body); `404` if the URL's
user id does not exist; unknown fields rejected.

## Comment

| Field | Type | Notes |
|---|---|---|
| `id` | integer, server-assigned | Immutable; continues Spec 002's numeric auto-increment store |
| `postId` | string (UUID) | Required; MUST reference an existing `Post.id` — set from the URL's parent post id on nested create, never from the request body |
| `userId` | integer | Required; MUST reference an existing `User.id`; author of the comment — supplied in the request body and validated (distinct from `postId`, which comes from the URL) |
| `body` | string, 1–1000 chars | Required |
| `createdAt` | ISO 8601 string, server-assigned | |

**Seed volume**: ≥200 records, distributed across seeded posts.

**Validation rules**: `POST /api/v1/posts/{id}/comments` validates `userId`/`body` via a `.strict()` `zod`
schema (`CommentCreate`); rejects with `400`/`422` if `userId` is missing or does not resolve to an
existing user; `404` if the URL's post id does not exist; unknown fields rejected.

## Review

| Field | Type | Notes |
|---|---|---|
| `id` | integer, server-assigned | Immutable |
| `productId` | integer | Required; MUST reference an existing `Product.id` |
| `userId` | integer | Required; MUST reference an existing `User.id`; author — seed-data consistency only, since this feature has no write path for Reviews |
| `rating` | integer, 1–5 inclusive | Required |
| `body` | string, 0–1000 chars | Optional review text, defaults to `""` |
| `createdAt` | ISO 8601 string, server-assigned | |

**Seed volume**: a representative subset of seeded products (enough to exercise both
`products/:id/reviews` and `reviews/by-rating/{rating}` meaningfully — at least 100 review records,
ratings cyclically distributed across 1–5 so every rating value has seed data).

**Validation rules**: none on write (no write path); `rating` bound (1–5) enforced on the
`reviews/by-rating/{rating}` path parameter by `src/utils/ratingParam.ts`.

## Payment

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID), server-assigned | Immutable; generated with `crypto.randomUUID()` |
| `orderId` | integer | Required; MUST reference an existing `Order.id` |
| `amount` | number, >= 0 | Server-derived from the referenced order's `total` at seed time |
| `status` | enum: `pending` \| `completed` \| `failed` \| `refunded` | Required |
| `processedAt` | string, calendar date (`YYYY-MM-DD`) | Required |
| `createdAt` | ISO 8601 string, server-assigned | |

**Seed volume**: exactly one Payment per seeded Order (≥100), `status` cyclically distributed across all
four enum values so every status (and a spread of dates) has seed data for
`payments/by-date/{date}` to return non-trivial results.

**Validation rules**: none on write (no write path in this feature; idempotent `POST /payments` is
introduced in Spec 008); date format/validity enforced on the `payments/by-date/{date}` path parameter by
`src/utils/dateParam.ts`.

## SearchResult (response-shape only, not a stored entity)

| Field | Type | Notes |
|---|---|---|
| `resourceType` | enum: `user` \| `customer` \| `product` \| `category` \| `post` \| `comment` \| `review` | Which resource this hit came from |
| `id` | string or integer | The matched record's own id, usable against that resource's own endpoint |
| `label` | string | The matched record's primary display text (e.g. a user's `name`, a post's `title`) |
| `snippet` | string, optional | A secondary matched field, when one exists (e.g. a post's `body` excerpt) |

A normalized, lightweight hit rather than an embedded full record (research.md), so the combined result
array stays one uniform, documentable shape regardless of which resource matched.

## Relationships

- `Post.userId` → `User.id`: every post has exactly one author; validated on nested create.
- `Comment.postId` → `Post.id`: every comment belongs to exactly one post; set from the URL, never the
  body.
- `Comment.userId` → `User.id`: every comment has exactly one author; supplied in the body, validated on
  nested create.
- `Review.productId` → `Product.id`, `Review.userId` → `User.id`: every review is for one product,
  written by one user; both fixed at seed time (no write path).
- `Payment.orderId` → `Order.id`: every payment corresponds to exactly one order; fixed at seed time
  (one payment per seeded order).
- `Product.category` (string) ↔ `Category.id` (slug): every seeded product's `category` value resolves
  to a Category record (`products/:id/category`); not every Category record has a product referencing it
  (research.md) — this is a read-only, additive relationship, not a schema change to `Product`.
- `User.id` ↔ `Customer.userId` ↔ `Order.customerId` (established in Spec 002): reused unchanged by
  `GET /api/v1/users/{id}/orders`.
- `Order.items[].productId` → `Product.id` (established in Spec 002): reused unchanged by
  `GET /api/v1/orders/{id}/products`, which returns the distinct products referenced by an order's line
  items.

## Shared envelopes (reused, not redefined)

- **List and nested-list responses** use `PaginationEnvelope` exactly as defined in Spec 001
  (`src/models/paginationEnvelope.ts`) — including `GET /api/v1/search`.
- **All error responses** use `ErrorEnvelope` exactly as defined in Spec 001
  (`src/models/errorEnvelope.ts`). This spec introduces no new error code beyond the existing
  `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, and `METHOD_NOT_ALLOWED` (all already defined by Specs
  001–002).

## New storage primitives

- `src/data/inMemoryStore.ts` (Spec 002, unchanged): numeric auto-increment store, reused as-is for
  Comment and Review.
- `src/data/keyedStore.ts` (new): `createKeyedStore<T extends { id: string }>()` — same
  `list/get/replace/patch/remove/reset` shape, but `create(record: T)` takes a fully-formed record (the
  caller already assigned `id` via `slugify()` or `crypto.randomUUID()`). Used for Category, Post, and
  Payment.
