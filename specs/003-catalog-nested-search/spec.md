# Feature Specification: Read-Only Catalog & Nested Resources + Search

**Feature Branch**: `003-catalog-nested-search`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 003 — Read-Only Catalog & Nested Resources + Search"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse the Read-Only Catalog (Priority: P1)

An automated testing tool or QA engineer lists and retrieves individual records from the five
read-oriented resources — categories, posts, comments, reviews, and payments — to confirm the
catalog surface is discoverable, correctly paginated, and stable across runs.

**Why this priority**: These five resources are the foundational data this entire spec adds. Every
nested route and the search endpoint depend on this data existing and being independently
retrievable first.

**Independent Test**: Can be fully tested by issuing `GET` against each resource's collection
endpoint and against several individual records' own URLs, and confirming the responses use the
standard pagination/error envelopes and match the documented seed volumes.

**Acceptance Scenarios**:

1. **Given** a freshly started server, **When** a client lists categories, posts, comments,
   reviews, or payments, **Then** the collection contains at least the documented minimum number
   of deterministic seed records inside the standard pagination envelope.
2. **Given** an existing record's identifier for any of the five resources, **When** a client
   sends `GET` to that record's own URL, **Then** the system returns `200` with the current
   representation of that exact record.
3. **Given** a syntactically valid identifier with no matching record, **When** requested, **Then**
   the system returns `404` with the standard error envelope.
4. **Given** a malformed identifier for the resource's identifier scheme (bad slug, invalid UUID,
   non-numeric/negative/zero/huge/empty numeric id), **When** requested, **Then** the system
   returns `400` with the standard error envelope rather than a `404` or a crash.
5. **Given** none of these five resources expose `POST`/`PUT`/`PATCH`/`DELETE` at their top-level
   collection or single-record URLs, **When** a client attempts one of those methods there,
   **Then** the system returns a structured `405 Method Not Allowed` response.

---

### User Story 2 - Traverse Parent-Child Relationships (Priority: P2)

A tester follows the real relationships between existing resources — a user's orders and posts, a
post's comments, a product's reviews and category, and an order's products — through nested routes,
to confirm the API exposes realistic relational navigation the way a real catalog/e-commerce/blog
API would.

**Why this priority**: Nested-resource navigation is the second most common pattern (after plain
CRUD) that contract and automation testing tools exercise, and it is explicitly called out as core
scope for this spec. It depends on User Story 1's data and on the Spec 002 resources already
existing.

**Independent Test**: Can be fully tested by picking known seeded parent identifiers and requesting
each documented nested route, confirming the returned children are exactly the ones related to that
parent, and that creating a new post or comment through a nested `POST` immediately shows up in both
the nested listing and the corresponding top-level listing.

**Acceptance Scenarios**:

1. **Given** an existing user identifier, **When** a client sends `GET
   /api/v1/users/{id}/orders`, **Then** the system returns the paginated set of orders placed by
   customers linked to that user (per the `customer.userId` link established in Spec 002), or an
   empty paginated set if none are linked.
2. **Given** an existing user identifier, **When** a client sends `GET /api/v1/users/{id}/posts`,
   **Then** the system returns the paginated set of posts authored by that user.
3. **Given** an existing user identifier and a valid post body, **When** a client sends `POST
   /api/v1/users/{id}/posts`, **Then** the system creates a new post authored by that user and
   returns `201` with the created representation, and the new post subsequently appears in `GET
   /api/v1/posts` and in the nested listing.
4. **Given** an existing post identifier, **When** a client sends `GET
   /api/v1/posts/{id}/comments`, **Then** the system returns the paginated set of comments on that
   post.
5. **Given** an existing post identifier and a valid comment body, **When** a client sends `POST
   /api/v1/posts/{id}/comments`, **Then** the system creates a new comment on that post and returns
   `201`, and the new comment subsequently appears in `GET /api/v1/comments` and in the nested
   listing.
6. **Given** an existing product identifier, **When** a client sends `GET
   /api/v1/products/{id}/reviews`, **Then** the system returns the paginated set of reviews for that
   product.
7. **Given** an existing product identifier, **When** a client sends `GET
   /api/v1/products/{id}/category`, **Then** the system returns the single Category record matching
   that product's `category` value.
8. **Given** an existing order identifier, **When** a client sends `GET
   /api/v1/orders/{id}/products`, **Then** the system returns the distinct products referenced by
   that order's line items.
9. **Given** a parent identifier that does not correspond to any existing user, post, product, or
   order, **When** any nested route above is requested, **Then** the system returns `404` with the
   standard error envelope before evaluating the nested collection.

---

### User Story 3 - Path Parameter Type Diversity (Priority: P3)

A tester exercises identifier edge cases across the full range of identifier formats this spec
introduces — slug, UUID, plain integer, a date-valued path segment, and an enum-valued path segment
— to confirm every format is validated and reported consistently, closing the parameter-type
coverage gap left open after Spec 002 (which only exercised plain numeric identifiers).

**Why this priority**: CLAUDE.md explicitly calls for int/UUID/string/slug/date/enum path parameter
coverage across the project; this spec is where the non-numeric formats are introduced, so their
edge-case behavior must be verified here rather than assumed.

**Independent Test**: Can be fully tested by calling the slug-keyed (`categories`), UUID-keyed
(`posts`, `payments`), date-keyed (`payments/by-date/{date}`), and enum-keyed
(`reviews/by-rating/{rating}`) endpoints with a table of valid, missing, malformed, and empty
identifiers, and confirming each returns the correct `200`/`400`/`404` outcome.

**Acceptance Scenarios**:

1. **Given** a category slug that exists, **When** requested at `GET /api/v1/categories/{slug}`,
   **Then** the system returns `200`; **given** a syntactically valid but unknown slug, **Then** it
   returns `404`; **given** a slug containing characters outside the documented slug format,
   **Then** it returns `400`.
2. **Given** a post or payment UUID that exists, **When** requested at its own URL, **Then** the
   system returns `200`; **given** a well-formed but unknown UUID, **Then** it returns `404`;
   **given** a malformed UUID string, **Then** it returns `400`.
3. **Given** a valid calendar date, **When** a client sends `GET
   /api/v1/payments/by-date/{date}`, **Then** the system returns the paginated set of payments
   processed on that date (possibly empty); **given** a malformed date (wrong format, invalid
   calendar date such as month 13), **Then** the system returns `400`.
4. **Given** one of the documented rating values, **When** a client sends `GET
   /api/v1/reviews/by-rating/{rating}`, **Then** the system returns the paginated set of reviews
   with that rating; **given** a value outside the documented rating enum, **Then** the system
   returns `400`.

---

### User Story 4 - Cross-Resource Search (Priority: P4)

A tester searches across resources with a single free-text query to confirm the API supports the
kind of exploratory, cross-cutting lookup that automation and contract-testing tools use as a
smoke-test entry point, and that it degrades predictably on edge-case input.

**Why this priority**: Search is the most complex, cross-cutting capability in this spec — it reads
from every resource introduced across Specs 002 and 003 — so it is sequenced last, after each
individual resource is confirmed retrievable on its own.

**Independent Test**: Can be fully tested by issuing `GET /api/v1/search?q=` with a matrix of query
values (a common term expected to match, an empty string, the parameter omitted entirely, a term
with no matches, special characters, a very long string, and case variants of a known match) and
confirming each case returns the documented status and shape.

**Acceptance Scenarios**:

1. **Given** a search term that matches records in one or more resources, **When** a client sends
   `GET /api/v1/search?q={term}`, **Then** the system returns `200` with a paginated set of matches,
   each tagged with the resource type it came from.
2. **Given** the `q` parameter is omitted entirely or supplied as an empty string, **When**
   requested, **Then** the system returns `400` with a structured validation error naming `q` as
   required.
3. **Given** a search term with no matching records anywhere, **When** requested, **Then** the
   system returns `200` with an empty `data` array inside the standard pagination envelope, not
   `404`.
4. **Given** a search term containing special characters (e.g. punctuation, symbols) or an
   excessively long string, **When** requested, **Then** the system returns a well-formed response
   (matches or empty results) and never crashes or returns an unstructured error.
5. **Given** a search term differing only in letter case from a known matching value, **When**
   requested, **Then** the system returns the same matches as the exact-case query.

---

### Edge Cases

- What happens when a nested collection's parent exists but has zero related children (e.g. a user
  with no posts, a product with no reviews)? The system must return `200` with an empty `data` array
  inside the standard pagination envelope, not `404`.
- What happens when `POST /api/v1/users/{id}/posts` or `POST /api/v1/posts/{id}/comments` is sent
  with an invalid body (missing required fields, wrong types, out-of-bounds values)? The system must
  reject it with a structured `400`/`422` validation error and create nothing, consistent with the
  write-validation rules established in Spec 002.
- What happens when a client attempts to supply or change the parent-linking field (`userId` on a
  nested-created post, `postId` on a nested-created comment) to a value other than the parent in the
  URL? The system must ignore the conflicting value and use the URL's parent identifier, or reject
  the request — applied consistently every time.
- What happens when `GET /api/v1/products/{id}/category` is requested for a product whose
  `category` value has no matching seeded Category record? This must not happen for any seeded
  product (every category value used by Spec 002 products is seeded as a Category record here); if
  it did occur for a future record, the system returns `404` rather than crashing.
- What happens when pagination, sorting, or filtering query parameters are combined with a nested or
  search route? They apply the same validation and behavior as on top-level list endpoints (invalid
  values rejected with `400`, valid values narrowing the returned set).
- What happens when the same query is sent to `/api/v1/search` repeatedly? Results must be identical
  every time against unchanged data (determinism).

## Requirements *(mandatory)*

### Functional Requirements

**Resource coverage**

- **FR-001**: System MUST expose read-only list and get-by-id operations — no `POST`, `PUT`,
  `PATCH`, or `DELETE` — at the top-level collection and single-record URLs for each of: categories,
  posts, comments, reviews, and payments. Attempting a write method there MUST return a structured
  `405`.
- **FR-002**: System MUST seed at least 20 deterministic category records, 100 post records, and 200
  comment records, plus a deterministic set of review records (covering a representative subset of
  seeded products) and payment records (one per seeded order, reflecting each order's transaction).
- **FR-003**: Seed data and the behavior of every endpoint in this feature MUST be reproducible
  across server restarts — identical requests against a freshly started server MUST return
  identical results.

**Identifiers & path parameters**

- **FR-004**: Category records MUST be addressable by a URL-safe slug identifier (e.g.
  `/api/v1/categories/electronics`); post and payment records MUST be addressable by a UUID
  identifier; comment and review records MUST be addressable by a plain numeric identifier,
  continuing the scheme established in Spec 002.
- **FR-005**: System MUST return `404` with the standard error envelope when a syntactically valid
  identifier (of any format above) does not match any existing record.
- **FR-006**: System MUST return `400` with the standard error envelope — never a server error or
  unhandled exception — when an identifier is malformed for its resource's scheme: an invalid slug
  format, a malformed UUID, or (for numeric ids) non-numeric, negative, zero, unreasonably large, or
  empty.
- **FR-007**: System MUST expose `GET /api/v1/payments/by-date/{date}`, returning the paginated set
  of payments processed on the given calendar date, and returning `400` for a malformed or invalid
  date rather than a crash or silent empty result.
- **FR-008**: System MUST expose `GET /api/v1/reviews/by-rating/{rating}`, returning the paginated
  set of reviews with the given rating value, and returning `400` when `rating` falls outside the
  documented rating enum.

**Nested resources**

- **FR-009**: System MUST expose `GET /api/v1/users/{id}/orders`, returning the paginated set of
  orders placed by customers linked to that user via the `customer.userId` relationship established
  in Spec 002.
- **FR-010**: System MUST expose `GET` and `POST /api/v1/users/{id}/posts` — listing posts authored
  by that user, and creating a new post authored by that user.
- **FR-011**: System MUST expose `GET` and `POST /api/v1/posts/{id}/comments` — listing comments on
  that post, and creating a new comment on that post.
- **FR-012**: System MUST expose `GET /api/v1/products/{id}/reviews`, returning the paginated set of
  reviews for that product.
- **FR-013**: System MUST expose `GET /api/v1/products/{id}/category`, returning the single Category
  record matching that product's `category` value.
- **FR-014**: System MUST expose `GET /api/v1/orders/{id}/products`, returning the distinct products
  referenced by that order's line items.
- **FR-015**: Every nested route above MUST return `404` with the standard error envelope when its
  parent identifier does not correspond to an existing record, evaluated before the nested
  collection itself; when the parent exists but has no related children, it MUST return `200` with
  an empty `data` array in the standard pagination envelope.
- **FR-016**: Nested list endpoints MUST support the same pagination (and, where a field is
  resource-appropriate, sorting/filtering) query parameters and validation as top-level list
  endpoints.
- **FR-017**: `POST /api/v1/users/{id}/posts` and `POST /api/v1/posts/{id}/comments` MUST validate
  the request body using the same validation categories as Spec 002 writes (missing required
  fields, wrong types, invalid enum/bounds values, unexpected fields) and reject invalid bodies with
  a structured `400`/`422` error, creating nothing.
- **FR-018**: A nested-created post or comment's parent-linking field (`userId`, `postId`) MUST be
  set from the URL's parent identifier; any conflicting value supplied in the request body MUST be
  ignored, never applied.
- **FR-019**: Identifiers on nested-created records MUST be server-assigned and immutable, matching
  the identifier-handling rule established in Spec 002.

**Search**

- **FR-020**: System MUST expose `GET /api/v1/search?q=`, matching the query term case-insensitively
  against the name/title/description-style fields of users, customers, products, categories, posts,
  comments, and reviews, and returning a paginated, combined result set in which each match is
  tagged with its source resource type.
- **FR-021**: System MUST return `400` with a structured validation error when `q` is omitted or is
  an empty string.
- **FR-022**: System MUST return `200` with an empty `data` array (not `404`) when `q` is
  well-formed but matches no records.
- **FR-023**: System MUST handle special characters and excessively long values in `q` without
  crashing, returning a well-formed success response in every case.

**Cross-cutting**

- **FR-024**: Every response produced by this feature — success or error — MUST include the
  `X-Request-ID` header, and every error body MUST embed the same request ID in the standard error
  envelope.

### Key Entities

- **Category**: A catalog grouping, keyed by a URL-safe slug. Key attributes: slug (identifier),
  display name, description. Corresponds one-to-one with the fixed set of `category` string values
  a Product may hold (Spec 002); referenced by `products/:id/category`.
- **Post**: A piece of user-authored content. Key attributes: UUID identifier, `userId` (author,
  references a User), title, body, published-at timestamp/date, creation metadata. Referenced by
  `users/:id/posts` and has child Comments.
- **Comment**: A remark on a Post. Key attributes: numeric identifier, `postId` (references a Post),
  author name or `userId`, body text, creation metadata. Referenced by `posts/:id/comments`.
- **Review**: Feedback on a Product. Key attributes: numeric identifier, `productId` (references a
  Product), `rating` (a fixed enum, e.g. 1–5), review text, author reference, creation metadata.
  Referenced by `products/:id/reviews` and `reviews/by-rating/{rating}`.
- **Payment**: A transaction record associated with an Order. Key attributes: UUID identifier,
  `orderId` (references an Order), amount, status, `processedAt` (a calendar date), creation
  metadata. Referenced by `payments/by-date/{date}`; not writable in this feature (transaction
  creation with idempotency support is introduced in a later spec).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the five new read-oriented resources, an automated client can list the
  collection and retrieve any individual seeded record, receiving the documented seed volume and a
  correctly structured response on every run.
- **SC-002**: Testers can traverse every documented parent-child relationship (users→orders/posts,
  posts→comments, products→reviews/category, orders→products) and receive results that exactly match
  the underlying relationship, with a `404` on every nonexistent-parent case and an empty result set
  (never a `404`) on every childless-parent case.
- **SC-003**: Posts and comments created through the nested `POST` endpoints are visible in both the
  nested listing and the corresponding top-level listing immediately after creation, 100% of the
  time.
- **SC-004**: 100% of identifier-format edge cases (valid, unknown-but-valid, and malformed) across
  slug, UUID, numeric, date, and enum-typed path parameters resolve to the correct `200`/`400`/`404`
  outcome, with zero server errors.
- **SC-005**: Cross-resource search returns correct results for every tested query variant (matching
  term, empty, missing, no-match, special-character, long, and case-variant queries) without ever
  crashing or returning an unstructured error.
- **SC-006**: List and search responses at the seeded data volumes return with no perceptible
  processing delay, consistent with this project's lightweight, load-testable endpoint design.

## Assumptions

- **Read-only scope for the five new resources**: matches CLAUDE.md's explicit framing of
  categories/posts/comments/reviews/payments as "read-oriented," except where CLAUDE.md and the
  project roadmap explicitly call for nested `POST` (creating a post under a user, a comment under a
  post). No top-level `POST /api/v1/posts` or `POST /api/v1/comments` exists in this feature.
- **Identifier scheme choices**: slugs for categories, UUIDs for posts and payments, and plain
  numeric ids for comments and reviews were chosen to deliberately cover the int/UUID/slug parameter
  types called for by CLAUDE.md, while the dedicated `payments/by-date/{date}` and
  `reviews/by-rating/{rating}` endpoints cover the remaining date and enum parameter types, without
  overloading any single resource's primary identifier with an unnatural type.
- **Category-Product relationship stays one-directional**: per the Spec 002 clarification, Product's
  `category` remains a plain constrained string with no foreign key; this spec's `Category` resource
  and `products/:id/category` route are additive and read-only, not a schema change to Product.
- **Payment seed volume**: one deterministic Payment per seeded Order (≥100), reflecting that every
  seeded order has an associated (simulated) transaction; Review seed volume covers a representative
  subset of seeded Products sufficient to exercise both the `products/:id/reviews` nested route and
  the `reviews/by-rating/{rating}` endpoint meaningfully.
- **Search scope**: cross-resource search covers users, customers, products, categories, posts,
  comments, and reviews (their name/title/description-style text fields); it does not search orders
  or payments, which lack free-text-searchable fields.
- **Nested-parent validation precedes collection evaluation**: every nested route checks the parent
  identifier's existence first, returning `404` before considering whether the nested collection is
  empty — this keeps "parent not found" and "parent found, no children" unambiguously distinguishable
  for automated tests.
- **No new authentication in this feature**: all endpoints introduced here remain unauthenticated,
  consistent with Spec 002; auth-gated access to these same resources is layered on by later specs
  per the project roadmap.
