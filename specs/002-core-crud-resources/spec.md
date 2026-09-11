# Feature Specification: Core CRUD Resources

**Feature Branch**: `002-core-crud-resources`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Spec 002 — Core CRUD Resources"

## Clarifications

### Session 2026-09-11

- Q: Should each Order be linked to a Customer, to a User account, or to both — and how does that connect to the future 'users/:id/orders' nested route from Spec 003? → A: Order references only `customerId`; Customer optionally links to a User account via `customer.userId`. The future `users/:id/orders` nested route resolves via that customer-user link.
- Q: What are the valid values for an order's status field? → A: `pending`, `processing`, `shipped`, `delivered`, `cancelled`.
- Q: Should a product's category be a plain string/enum attribute, or a foreign-key reference to a separate category record? → A: Plain string field constrained to a fixed set of values, with no foreign-key dependency on the Category resource introduced in Spec 003.
- Q: What are the valid values for a user's role attribute? → A: `user`, `admin`, `manager`, `readonly`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full CRUD Lifecycle on a Core Resource (Priority: P1)

An automated testing tool (or a QA engineer scripting a test case) needs to exercise the complete
lifecycle of a resource — create it, read it back individually and in a list, update it fully and
partially, then delete it — against each of the four core resources: users, products, orders, and
customers.

**Why this priority**: This is the foundational capability of the whole feature. Without working
create/read/update/delete on real, realistically-shaped data, no downstream spec (nested resources,
auth-protected access, error simulation, k6 workflows) has anything to operate on.

**Independent Test**: Can be fully tested by, for each resource, issuing `POST` to create a new
record, `GET` on the collection and on the new record's own URL, `PUT` and `PATCH` to update it, and
`DELETE` to remove it — confirming each response reflects the expected state and that the deleted
record subsequently returns `404`.

**Acceptance Scenarios**:

1. **Given** an empty request body of valid data for a resource, **When** a client `POST`s to the
   resource's collection endpoint, **Then** the system creates the record, assigns it a unique
   identifier, and returns `201` with the created representation.
2. **Given** an existing record's identifier, **When** a client sends `GET` to that record's URL,
   **Then** the system returns `200` with the current representation of that exact record.
3. **Given** an existing record's identifier and a full valid replacement body, **When** a client
   sends `PUT`, **Then** the system replaces the record's fields with the supplied values and returns
   `200` with the updated representation.
4. **Given** an existing record's identifier and a partial valid body, **When** a client sends
   `PATCH`, **Then** the system updates only the supplied fields, leaves the rest unchanged, and
   returns `200` with the merged representation.
5. **Given** an existing record's identifier, **When** a client sends `DELETE`, **Then** the system
   removes the record and returns a success status, and a subsequent `GET` for that identifier
   returns `404`.
6. **Given** a freshly started server, **When** a client lists any of the four resources, **Then**
   the collection contains the documented minimum number of deterministic seed records.

---

### User Story 2 - Validation Rejection on Write Operations (Priority: P2)

A tester deliberately sends malformed, incomplete, or out-of-range data on create/update requests to
confirm the system rejects it safely and predictably instead of crashing or silently accepting bad
data.

**Why this priority**: Negative testing is a named purpose of this project. A mock server that only
handles the happy path is not useful as a testing target — the ability to reliably trigger validation
failures is as important as the ability to succeed.

**Independent Test**: Can be fully tested by sending a battery of invalid payloads (missing required
fields, wrong types, invalid email/UUID/enum values, out-of-bounds numbers/strings, null values, empty
strings/arrays, deeply nested objects, and unexpected extra fields) to each resource's `POST`/`PUT`/
`PATCH` endpoints and confirming every one is rejected with a structured error and the correct status
code, with no impact on existing data.

**Acceptance Scenarios**:

1. **Given** a `POST` body missing a required field, **When** submitted, **Then** the system responds
   `400` or `422` with a structured error naming the missing field, and no record is created.
2. **Given** a `POST` body with a field of the wrong data type (e.g. a string where a number is
   expected), **When** submitted, **Then** the system responds with a structured validation error and
   creates no record.
3. **Given** a `POST` body with an invalid email, invalid UUID-formatted reference, or a value outside
   an enumerated set, **When** submitted, **Then** the system responds with a structured validation
   error identifying the offending field.
4. **Given** a `POST` body with a string or number outside its documented min/max bounds, a `null` in
   a required field, or an empty string/array where content is required, **When** submitted, **Then**
   the system responds with a structured validation error.
5. **Given** a `POST` or `PATCH` body containing a field not defined on the resource, **When**
   submitted, **Then** the system either rejects the request with a structured error or ignores the
   unexpected field without persisting it — consistently, per a single documented policy.
6. **Given** any of the above invalid requests, **When** submitted repeatedly, **Then** the system
   never crashes or returns an unstructured (non-error-envelope) response.

---

### User Story 3 - Path Parameter Edge Cases (Priority: P3)

A tester probes single-resource endpoints (`GET`/`PUT`/`PATCH`/`DELETE` by identifier) with edge-case
identifiers — valid, missing, malformed, negative, zero, extremely large, and empty — to confirm the
system responds predictably in every case.

**Why this priority**: Identifier-handling bugs (crashes on malformed IDs, inconsistent 404 vs 400
behavior) are among the most common defects that automated negative-test suites are built to catch.

**Independent Test**: Can be fully tested by calling each single-resource endpoint with a table of
edge-case identifiers per resource and confirming each returns the documented, correct status code
without crashing the server.

**Acceptance Scenarios**:

1. **Given** a syntactically valid identifier that does not correspond to any existing record,
   **When** requested, **Then** the system returns `404` with a structured "not found" error.
2. **Given** a malformed identifier (wrong type/format for the resource's identifier scheme, e.g.
   non-numeric text where a numeric ID is expected), **When** requested, **Then** the system returns
   `400` with a structured validation error rather than a `404` or a crash.
3. **Given** a negative, zero, or extremely large numeric identifier, **When** requested, **Then**
   the system returns a structured `400` or `404` response as appropriate, never a `500` or an
   unhandled exception.
4. **Given** an empty identifier segment, **When** requested, **Then** the system returns the
   appropriate `400` or `404` response consistent with its routing rules.

---

### User Story 4 - Pagination, Sorting, and Filtering on List Endpoints (Priority: P4)

A tester or automated client lists a core resource's collection using pagination, sorting, and
filtering query parameters — individually and combined — to confirm the returned set and its
envelope metadata are correct.

**Why this priority**: Realistic API consumers rarely fetch an entire collection unfiltered; this
capability is required for the CRUD resources to support the query patterns testing tools actually
exercise, and it depends on User Story 1's collections already existing.

**Independent Test**: Can be fully tested by requesting a resource's collection with various
combinations of `page`, `limit`, `sort`, and resource-appropriate filter parameters, and confirming
the returned data set and pagination metadata match what was requested.

**Acceptance Scenarios**:

1. **Given** a collection with more records than one page's `limit`, **When** listed with `page` and
   `limit` query parameters, **Then** the response returns exactly that page of records inside the
   standard pagination envelope with accurate `total`, `totalPages`, `hasNext`, and `hasPrevious`
   values.
2. **Given** an invalid pagination value (e.g. `page=0`, negative `limit`, or a non-numeric value),
   **When** requested, **Then** the system returns a structured `400` validation error rather than
   silently defaulting or crashing.
3. **Given** a `sort` parameter naming a valid field (ascending) or the same field prefixed with `-`
   (descending), **When** requested, **Then** the returned records are ordered accordingly.
4. **Given** one or more supported filter query parameters, **When** requested individually or
   combined, **Then** only records matching all supplied filter criteria are returned.

---

### Edge Cases

- What happens when a client attempts to change a resource's identifier field via `PUT`/`PATCH`? The
  system must ignore or reject the change — identifiers are immutable once assigned.
- What happens when `PUT` is sent with a partial body (fields omitted that a full replacement should
  include)? The system must treat this as a validation error, since `PUT` semantics require a
  complete representation, distinguishing it from `PATCH`.
- What happens when two conflicting filter query parameters are supplied for the same field? The
  system must resolve this deterministically (e.g. last value wins, or reject as invalid) and behave
  the same way on every request.
- What happens when `sort` names a field that does not exist on the resource? The system must return
  a structured `400` validation error rather than silently ignoring it or crashing.
- What happens when a `DELETE` is issued twice for the same identifier? The second call must return
  `404`, not a repeated success or a crash.
- What happens when an order references a product or customer identifier that does not exist? The
  system must reject the write with a structured validation error rather than creating a dangling
  reference.
- What happens when a customer record has no linked user account? This is valid and expected — the
  `userId` link on Customer is optional, since not every customer corresponds to a registered user.
- What happens when an order's `status` or a user's `role` is set to a value outside its fixed set of
  valid values? The system must reject the write with a structured invalid-enum validation error.
- How does the system behave when the seed data is queried immediately after server startup, before
  any writes occur? Results must be identical across restarts (determinism).

## Requirements *(mandatory)*

### Functional Requirements

**Resource coverage**

- **FR-001**: System MUST expose full CRUD operations — list, get-by-id, create, full-update,
  partial-update, delete — for each of the four core resources: users, products, orders, and
  customers.
- **FR-002**: System MUST seed at least 50 deterministic user records, 50 product records, and 100
  order records at startup, plus a deterministic set of customer records sufficient to back every
  seeded order.
- **FR-003**: Seed data and the behavior of every endpoint in this feature MUST be reproducible
  across server restarts — identical requests against a freshly started server MUST return identical
  results.

**Identifiers & path parameters**

- **FR-004**: Every core resource record MUST be addressable by a unique identifier in its
  single-resource endpoint URL (e.g. `/api/v1/users/{id}`).
- **FR-005**: System MUST return `404` with the standard error envelope when a syntactically valid
  identifier does not match any existing record.
- **FR-006**: System MUST return `400` with the standard error envelope — never a server error or
  unhandled exception — when an identifier is malformed, negative, zero, non-numeric where numeric is
  expected, unreasonably large, or empty.

**Reads & listing**

- **FR-007**: System MUST return list responses inside the standard pagination envelope (`data`,
  `page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrevious`).
- **FR-008**: System MUST support `page` and `limit` query parameters on every list endpoint in this
  feature, applying documented defaults when omitted and returning a `400` validation error for
  invalid values (non-numeric, zero or negative page, non-positive or excessive limit).
- **FR-009**: System MUST support sorting list results via a `sort` query parameter accepting a field
  name for ascending order or a `-`-prefixed field name for descending order, rejecting unknown sort
  fields with a `400` validation error.
- **FR-010**: System MUST support filtering list results by at least one resource-relevant field per
  resource (e.g. status/category/role-style attributes), individually and in combination, returning
  only records matching all supplied filters.

**Writes & validation**

- **FR-011**: System MUST validate every `POST`, `PUT`, and `PATCH` request body against the target
  resource's schema and reject invalid requests with `400` or `422` using the standard error envelope,
  never allowing invalid input to crash the process or persist.
- **FR-012**: Validation MUST cover, at minimum: missing required fields, wrong field types, invalid
  email format, invalid UUID-formatted references, invalid enum values, out-of-bounds string length or
  numeric range, `null` in required fields, empty strings/arrays where content is required, and
  malformed nested objects/arrays.
- **FR-013**: System MUST apply one consistent, documented policy for request bodies containing
  fields not defined on the resource (reject the whole request, or silently drop the unknown fields)
  across all four resources.
- **FR-014**: System MUST treat resource identifiers as immutable — a client-supplied identifier
  value in a create body MUST NOT override server-assigned identifier logic, and identifier fields
  supplied in update bodies MUST be ignored or rejected, never applied.
- **FR-015**: System MUST validate cross-resource references on write — an order's `customerId` and
  its line items' product identifiers — and reject the write with a structured validation error if a
  referenced identifier does not exist.
- **FR-016**: Every response produced by this feature — success or error — MUST include the
  `X-Request-ID` header, and every error body MUST embed the same request ID in the standard error
  envelope.
- **FR-017**: A user's `role` attribute MUST be constrained to one of `user`, `admin`, `manager`, or
  `readonly`; create/update requests supplying any other value MUST be rejected as an invalid enum
  value.
- **FR-018**: An order's `status` attribute MUST be constrained to one of `pending`, `processing`,
  `shipped`, `delivered`, or `cancelled`; create/update requests supplying any other value MUST be
  rejected as an invalid enum value.
- **FR-019**: A product's `category` attribute MUST be a plain string constrained to a fixed set of
  category values defined within this feature, independent of the `categories` resource introduced by
  a later spec; create/update requests supplying a value outside that set MUST be rejected as an
  invalid enum value.
- **FR-020**: A customer record MAY optionally reference a linked user account via a `userId` field;
  when present, it MUST reference an existing user, but its absence MUST NOT be treated as invalid.
  Order records MUST reference only a `customerId` — not a `userId` directly.

### Key Entities

- **User**: An account-holder record. Key attributes: unique identifier, name, email (unique,
  validated format), `role` (one of `user`, `admin`, `manager`, `readonly`), and account
  status/creation metadata. Represents the people who can be looked up, listed, and administered
  through the API (independent of any authentication mechanism, which is out of scope for this
  feature).
- **Product**: A sellable catalog item. Key attributes: unique identifier, name, description, price,
  a `category` (a plain string constrained to a fixed set of values, not a foreign key), and
  stock/availability metadata. Referenced by orders.
- **Customer**: A purchaser record distinct from a user account. Key attributes: unique identifier,
  name, contact/email information, address metadata, and an optional `userId` linking this customer
  to a User account (absent for customers with no registered account). Referenced by orders as the
  party who placed them.
- **Order**: A purchase transaction. Key attributes: unique identifier, a `customerId` referencing
  the customer who placed it, one or more line items referencing products with quantities, a
  `status` (one of `pending`, `processing`, `shipped`, `delivered`, `cancelled`), a total, and
  creation metadata. Represents the relationship between customers and products. Orders reference
  customers, never users, directly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every one of the four core resources, an automated client can perform a complete
  create → read → update → partial-update → delete sequence and observe a consistent, correctly
  structured response at every step, on every run.
- **SC-002**: 100% of invalid create/update requests across all four resources — spanning every
  validation category listed in FR-012 — are rejected with a structured error and never crash the
  server or corrupt existing data.
- **SC-003**: 100% of path-parameter edge cases (missing, malformed, negative, zero, oversized, empty
  identifiers) across the four resources resolve to a structured `400` or `404` response rather than
  a server error.
- **SC-004**: A freshly started server always returns the same seed data and the same responses to
  the same requests, with zero observed variance across repeated restarts.
- **SC-005**: Testers can retrieve any page of any core resource's collection, sorted and filtered by
  any documented combination of parameters, and receive a result set and pagination metadata that
  exactly match the applied criteria, on every request.
- **SC-006**: List responses for the seeded data volumes (≥50–100 records per resource) are returned
  in a time consistent with a lightweight, load-testable endpoint (no perceptible processing delay
  under normal conditions).

## Assumptions

- **Users vs. customers are distinct resources**: "users" represent account-holder records intended
  for API-level administration/lookup (and, in later specs, authentication), while "customers" are the
  purchasing parties referenced by orders and may optionally link to a user account (see
  Clarifications). This mirrors common e-commerce API design and matches CLAUDE.md listing both as
  separate first-class CRUD resources.
- **Identifier scheme**: core resources in this feature use simple, sortable identifiers (e.g.
  sequential numeric IDs) so that the required negative/zero/huge/malformed/empty numeric edge cases
  can be exercised directly; UUID, slug, date, and enum-typed path parameters are exercised by the
  read-oriented and nested resources introduced in the next spec, per the project roadmap.
- **Unknown-field policy default**: request bodies containing undocumented fields are rejected with a
  `400` validation error (the stricter of the two reasonable options), unless a future spec revision
  specifies otherwise.
- **No authentication in this feature**: these endpoints are unauthenticated in this spec; JWT/API
  key/Basic auth protections are layered on by later specs (per the project roadmap) and are out of
  scope here.
- **Nested and related-resource routes are out of scope**: `users/:id/orders`, `products/:id/reviews`,
  and similar nested routes belong to the read-only catalog & nested resources spec that follows this
  one; this feature only covers each resource's own top-level collection and single-record endpoints,
  though orders do reference products and customers internally as described above.
- **Search is out of scope**: cross-resource `search` functionality is delivered in a later spec.
