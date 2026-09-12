# Feature Specification: Admin & Reset

**Feature Branch**: `011-admin-reset`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 011 — Admin & Reset"

## Clarifications

### Session 2026-09-12

- Q: How should the admin credential be presented on `POST /admin/reset` and
  `POST /admin/auth/reset`? → A: A dedicated `X-Admin-Token` request header, mirroring the project's
  existing `X-API-Key` shared-secret convention rather than reusing the `Authorization: Bearer` scheme
  or a JSON body field.
- Q: What should the success response body from these reset endpoints contain? → A: A simple
  acknowledgment — a message confirming which domain was reset (`data` or `auth`) plus the standard
  `requestId` — with no per-subsystem counts or timestamp; verification that the reset actually
  happened belongs to subsequent `GET` calls, not the reset response itself.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Restore Resource Data to Its Seeded State Between Test Runs (Priority: P1)

A tester running a full regression or k6 workflow suite needs every CRUD resource (users, products,
orders, customers, categories, posts, comments, reviews, payments, files, and the cache-demo resource)
back to its exact original seed content before the next run, without restarting the server process,
so that test runs stay independent and repeatable.

**Why this priority**: This is the core value of the feature (CLAUDE.md #27) and the reason the whole
spec exists — every other CRUD/read-oriented spec (002, 003, 008, 009) accumulates mutations that would
otherwise leak between test runs and make results non-reproducible.

**Independent Test**: Can be fully tested by mutating several resources (e.g. creating a user, deleting
a product, updating an order), calling `POST /admin/reset` with a valid admin credential, then
confirming every resource's list/detail responses exactly match the original seed data byte-for-byte,
and that rate-limit and idempotency state have also been cleared.

**Acceptance Scenarios**:

1. **Given** one or more resources have been mutated via prior `POST`/`PUT`/`PATCH`/`DELETE` calls,
   **When** an admin calls `POST /admin/reset` with a valid admin credential, **Then** the system
   returns `200` confirming success and every resource returns to its original seeded content on the
   next read.
2. **Given** the real rate limiter (Spec 008) has been driven past its threshold, **When** an admin
   calls `POST /admin/reset`, **Then** the rate-limit counters are cleared and the next request is no
   longer rate-limited.
3. **Given** one or more `Idempotency-Key` values have been recorded by prior `POST /payments` calls
   (Spec 008), **When** an admin calls `POST /admin/reset`, **Then** the idempotency store is cleared
   and a previously used key is accepted again as a new request.
4. **Given** no resource has been mutated since the last reset (or server start), **When** an admin
   calls `POST /admin/reset`, **Then** the system still returns `200` and leaves every resource
   unchanged — the operation is safe to call repeatedly.

---

### User Story 2 - Restore Auth State to Its Initial Configuration (Priority: P2)

A tester exercising the JWT and API-key auth specs (005, 006) needs issued tokens, revoked-token
records, and issued API keys cleared back to their initial state independently of the data reset in
User Story 1, so that auth-specific test suites can start from a clean slate without also having to
re-seed unrelated CRUD resources.

**Why this priority**: Auth state (tokens, revocation records, API keys) is a distinct subsystem from
CRUD resource data (CLAUDE.md #7, #10) and its own spec's acceptance criteria depend on being able to
reset it; it is split into its own endpoint precisely so a caller can reset one domain without the
other.

**Independent Test**: Can be fully tested by issuing a JWT, revoking a refresh token, and issuing then
revoking an API key, calling `POST /admin/auth/reset` with a valid admin credential, then confirming
all previously issued tokens/API keys are rejected as unknown and the demo/convenience credentials
described in Specs 005 and 006 work exactly as they did on a fresh server start.

**Acceptance Scenarios**:

1. **Given** one or more JWTs have been issued and/or refresh tokens revoked via Spec 005's endpoints,
   **When** an admin calls `POST /admin/auth/reset`, **Then** the system returns `200` and every
   previously issued session/refresh token is no longer recognized.
2. **Given** one or more API keys have been issued or revoked via Spec 006's endpoints, **When** an
   admin calls `POST /admin/auth/reset`, **Then** the system returns `200` and every previously issued
   API key is no longer recognized.
3. **Given** `POST /admin/auth/reset` has just been called, **When** the client re-authenticates using
   the project's documented convenience/demo credentials, **Then** authentication succeeds exactly as
   it would immediately after a fresh server start.
4. **Given** `POST /admin/auth/reset` is called, **When** the response is inspected, **Then** CRUD
   resource data untouched by this endpoint (users, products, orders, etc.) remains exactly as it was
   beforehand — this endpoint MUST NOT reset resource data, mirroring User Story 1 not resetting auth
   state.

---

### User Story 3 - Prevent Unauthorized Callers From Resetting Server State (Priority: P3)

An automated test runner or a malicious/careless client without the admin credential must not be able
to wipe out another team's in-progress test data by calling either reset endpoint, so that the reset
capability stays a deliberate, gated administrative action rather than an open endpoint any caller can
trigger.

**Why this priority**: Both reset endpoints are destructive by design; without this access control they
would be a shared, unauthenticated way for any client of the mock server to disrupt every other
concurrent user's test session. It is lower priority than Stories 1-2 only because it is a guard rail
around functionality that must exist first to be worth guarding.

**Independent Test**: Can be fully tested by calling `POST /admin/reset` and `POST /admin/auth/reset`
with a missing, empty, or incorrect admin credential and confirming each attempt is rejected without
performing any reset, verified by checking that a mutation made just before the rejected call is still
present afterward.

**Acceptance Scenarios**:

1. **Given** no admin credential is supplied, **When** a client calls `POST /admin/reset` or
   `POST /admin/auth/reset`, **Then** the system returns `401` with an `UNAUTHORIZED` code and performs
   no reset.
2. **Given** an admin credential that does not match the configured admin token, **When** a client
   calls either reset endpoint, **Then** the system returns `403` with a `FORBIDDEN` code and performs
   no reset.
3. **Given** a prior resource mutation, **When** a reset call is rejected under scenarios 1 or 2 above,
   **Then** that mutation is still present immediately afterward, confirming the rejected call had no
   side effect.

---

### Edge Cases

- What happens when `POST /admin/reset` is called while another request is concurrently reading or
  writing a resource? The reset MUST leave the store in a consistent state — no partially-reset
  resource collection — rather than a state that mixes seed and stale data.
- What happens when the `X-Admin-Token` header is present but its **value** is malformed (e.g. wrong
  casing or extra whitespace relative to the configured token; an empty string is handled separately
  as "missing," per FR-002)? It MUST be treated as an invalid credential (`403`), not crash the
  request handler. (Header **names** are case-insensitive per HTTP and are not a source of ambiguity
  here — only the credential value itself is compared.)
- What happens when `ADMIN_TOKEN` is left at its documented example default? The server MUST still
  enforce it like any other configured value — this feature does not special-case the example value,
  it is solely the deployer's responsibility to change it for any non-local use.
- What happens when `POST /admin/reset` or `POST /admin/auth/reset` is called with a request body?
  The system MUST ignore any body content and still perform the documented reset — these endpoints
  take no meaningful input beyond the admin credential.
- What happens when both endpoints are called back-to-back in either order? Each MUST only affect its
  own domain (data vs. auth) regardless of call order, and calling both MUST leave the server
  equivalent to a fresh start across both domains.

## Requirements *(mandatory)*

### Functional Requirements

**Admin authentication**

- **FR-001**: System MUST gate both `POST /admin/reset` and `POST /admin/auth/reset` behind a single
  configurable admin credential, sourced from the `ADMIN_TOKEN` environment variable, with no default
  bypass, presented by the caller via a dedicated `X-Admin-Token` request header.
- **FR-002**: System MUST reject a request to either endpoint with `401` and an `UNAUTHORIZED` code
  when the `X-Admin-Token` header is missing or empty.
- **FR-003**: System MUST reject a request to either endpoint with `403` and a `FORBIDDEN` code when
  an admin credential is supplied but does not match the configured `ADMIN_TOKEN`.
- **FR-004**: System MUST NOT perform any reset side effect when a request is rejected under FR-002 or
  FR-003.

**Data reset**

- **FR-005**: System MUST expose `POST /admin/reset` that, given a valid admin credential, restores
  every CRUD/read-oriented resource collection (users, products, orders, customers, categories, posts,
  comments, reviews, payments, files, and the cache-demo resource) to its original deterministic seed
  content, discarding every mutation made since server start or the last reset, and MUST also restore
  the shared seeded random source that drives Spec 008/010's probabilistic failure behavior
  (`GET /flaky`, `scenario=*`'s `failureRate`) to its fixed initial state — required by the
  constitution's Determinism & Reproducibility principle (NON-NEGOTIABLE), so a test suite calling
  this endpoint between runs gets the exact same sequence of simulated outcomes every time.
- **FR-006**: System MUST, as part of `POST /admin/reset`, clear the real rate-limiter's counters
  (Spec 008) so the next request to a rate-limited endpoint starts from an unthrottled state.
- **FR-007**: System MUST, as part of `POST /admin/reset`, clear the idempotency-key store (Spec 008)
  so a previously used `Idempotency-Key` is accepted again as new.
- **FR-008**: System MUST NOT alter auth-domain state (issued JWTs/refresh tokens, revoked-token
  records, issued/revoked API keys) as part of `POST /admin/reset`.
- **FR-009**: `POST /admin/reset` MUST be safe to call when no mutation has occurred, leaving all data
  unchanged and still returning a success response.

**Auth reset**

- **FR-010**: System MUST expose `POST /admin/auth/reset` that, given a valid admin credential,
  invalidates every previously issued JWT session/refresh token record and every issued/revoked API
  key, and restores the project's documented convenience/demo credentials (Specs 005, 006) to their
  initial working state.
- **FR-011**: System MUST NOT alter any CRUD/read-oriented resource data, rate-limit state, or
  idempotency state as part of `POST /admin/auth/reset`.
- **FR-012**: `POST /admin/auth/reset` MUST be safe to call when no token or API key has been issued
  since the last reset, leaving state unchanged and still returning a success response.

**Cross-cutting**

- **FR-013**: Both endpoints MUST return a simple acknowledgment response — a message confirming which
  domain was reset (`data` or `auth`) plus the standard `requestId` — with no per-subsystem counts or
  timestamp fields; every response, success or error, MUST also carry the `X-Request-ID` header.
- **FR-014**: Neither endpoint MUST ever throw an unhandled exception or crash the process, regardless
  of credential validity, request body content, or concurrent in-flight requests.
- **FR-015**: This feature's behavior MUST be fully documented in the project's OpenAPI specification,
  including the admin credential's security scheme, both endpoints' request/response shapes, and the
  `401`/`403` failure responses.

### Key Entities

- **Admin Credential**: The single shared secret (`ADMIN_TOKEN`) a caller must present to authorize
  either reset endpoint; not tied to any specific user, role, or scope from Spec 005/006.
- **Data Reset Scope**: The set of stateful subsystems `POST /admin/reset` restores — every CRUD/
  read-oriented resource collection, the rate-limiter's counters, the idempotency-key store, and the
  shared seeded random source behind Spec 008/010's probabilistic failure behavior.
- **Auth Reset Scope**: The set of stateful subsystems `POST /admin/auth/reset` restores — issued JWT
  session/refresh token records, revoked-token records, and issued/revoked API keys.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any sequence of resource mutations, a single call to `POST /admin/reset` restores
  100% of CRUD/read-oriented resource collections to their original seed content, verified by exact
  comparison against a freshly started server.
- **SC-002**: After driving the rate limiter or reusing idempotency keys, a single call to
  `POST /admin/reset` clears both, verified by the very next relevant request no longer being throttled
  or rejected as a duplicate.
- **SC-003**: After issuing or revoking any number of tokens or API keys, a single call to
  `POST /admin/auth/reset` makes 100% of them unrecognized, while leaving 100% of unrelated resource
  data unchanged.
- **SC-004**: 100% of reset attempts with a missing or incorrect admin credential are rejected with no
  observable state change, verified across repeated attempts.
- **SC-005**: A full automated test suite can call either reset endpoint between test cases without
  requiring a server restart, keeping every test case's starting state reproducible.

## Assumptions

- **Both endpoints are top-level, unauthenticated-by-default-scheme paths outside `/api/v1`**: they sit
  alongside the project's other cross-cutting operational endpoints, gated by their own dedicated admin
  credential rather than the `/api/v1` resource surface's JWT/API-key/Basic auth schemes.
- **The domain split (data vs. auth) matches the project roadmap's existing design decision**: `POST
  /admin/reset` restores resource/data-plane state (CRUD collections, rate-limit counters, idempotency
  keys), while `POST /admin/auth/reset` restores auth-plane state (tokens, API keys) — each independent
  of the other so a caller can reset one domain without disturbing the other.
- **The uploaded-files resource (Spec 009) and the cache-demo resource (Spec 008) are treated as
  data-plane resources**: both are reset by `POST /admin/reset` alongside the primary CRUD resources,
  since they hold resource content rather than auth state.
- **No new environment variables beyond `ADMIN_TOKEN`**: already defined in the project's
  `.env.example`; this feature introduces no configuration of its own.
- **This feature depends on every prior spec that introduces mutable state** (002, 003, 005, 006, 008,
  009) already being implemented, since it must know about each subsystem's reset mechanism; it does
  not depend on Spec 004, 007, or 010, none of which hold state that survives a single request.
