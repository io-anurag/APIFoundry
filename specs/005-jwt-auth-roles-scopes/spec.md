# Feature Specification: JWT Authentication, Roles & Scopes

**Feature Branch**: `005-jwt-auth-roles-scopes`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 005 — JWT Authentication, Roles & Scopes"

## Clarifications

### Session 2026-09-12

- Q: Should `POST /auth/token` (which can mint a token for any role/scope, including `admin`,
  without going through login) require any caller authorization itself, or stay fully open as a
  test-support convenience? → A: Stay open/unauthenticated — consistent with how CLAUDE.md treats
  `/auth/login` and `/auth/token` as peer convenience endpoints, and with this project's purpose
  as a testing playground rather than a system protecting real data.
- Q: What URL pattern should the scope-gated demo endpoints use, since CLAUDE.md specifies a path
  for the role demo (`GET /api/v1/role/{role}`) but not for scopes? → A: `GET /api/v1/scope/{scope}`
  — one generic, enumerable endpoint per documented scope, mirroring the existing role-demo pattern
  for a consistent OpenAPI shape.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log In, Establish Identity, Log Out (Priority: P1)

A tester or automated testing tool signs in with a known demo credential, receives a token pair,
confirms who they are authenticated as, and later logs out — the foundational session lifecycle
every other authenticated scenario in this project builds on.

**Why this priority**: Without a working login/identity/logout cycle, no other scoped or
role-gated scenario can be exercised. This is the entry point for every downstream auth flow
(chained k6 workflows explicitly start with login).

**Independent Test**: Can be fully tested by calling `POST /auth/login` with a valid demo
credential, using the returned access token to call `GET /auth/me` and confirm the expected
identity/role/scopes come back, then calling `POST /auth/logout` and confirming the same token no
longer works.

**Acceptance Scenarios**:

1. **Given** a valid demo username/password, **When** the client calls `POST /auth/login`, **Then**
   the system returns `200` with an access token, a refresh token, the token type, and the access
   token's expiry.
2. **Given** an invalid username or password, **When** the client calls `POST /auth/login`,
   **Then** the system returns `401` with the standard error envelope and issues no token.
3. **Given** a valid access token, **When** the client calls `GET /auth/me`, **Then** the system
   returns `200` with the authenticated identity's user id, username, role, and scopes.
4. **Given** a valid refresh token, **When** the client calls `POST /auth/refresh`, **Then** the
   system returns `200` with a new access token (and, per rotation policy, a new refresh token),
   without requiring the original credentials again.
5. **Given** a valid access token, **When** the client calls `POST /auth/logout`, **Then** the
   system returns `200` and the token is subsequently rejected as revoked on later use.
6. **Given** a refresh token that has already been used to log out or has been rotated away,
   **When** the client calls `POST /auth/refresh` with it, **Then** the system returns `401`.

---

### User Story 2 - Issue and Inspect Purpose-Built Tokens for Automated Testing (Priority: P2)

An automated test suite needs tokens in specific failure states — expired, invalid signature, and
revoked — without waiting for real time to pass or performing a full login, so it can assert how
protected endpoints behave under each condition on demand and reproducibly.

**Why this priority**: CLAUDE.md calls out "convenience issuers for valid/expired/invalid/revoked
tokens" as a first-class requirement, because waiting for a real token to expire is impractical for
automated regression and load-testing suites.

**Independent Test**: Can be fully tested by calling `POST /auth/token` with each documented
`kind` value (`valid`, `expired`, `invalid`, `revoked`) and confirming: (a) `GET /auth/token-info`
against each token reports the expected state, and (b) each token behaves correctly (accepted or
rejected with the correct reason) when presented to `GET /api/v1/protected`.

**Acceptance Scenarios**:

1. **Given** a request for a `valid` token with a chosen role and scopes, **When** the client
   calls `POST /auth/token`, **Then** the system returns a token that is accepted by protected
   endpoints and carries exactly the requested role and scopes.
2. **Given** a request for an `expired` token, **When** the client calls `POST /auth/token`,
   **Then** the system returns a token whose expiry is already in the past, and any subsequent use
   of it against a protected endpoint returns `401` with a reason indicating expiry.
3. **Given** a request for an `invalid` token, **When** the client calls `POST /auth/token`,
   **Then** the system returns a token with a broken signature (or otherwise structurally invalid),
   and any subsequent use of it returns `401` with a reason indicating signature/verification
   failure.
4. **Given** a request for a `revoked` token, **When** the client calls `POST /auth/token`, **Then**
   the system returns a well-formed, unexpired token that is already recorded as revoked, and any
   subsequent use of it returns `401` with a reason indicating revocation.
5. **Given** any token produced by `POST /auth/token` or `POST /auth/login`, **When** the client
   calls `GET /auth/token-info` with it, **Then** the system returns the token's decoded claims
   (subject, role, scopes, issuer, audience, issued-at, expiry) and a computed validity state,
   without requiring the token to still be usable.
6. **Given** a malformed or empty token, **When** the client calls `GET /auth/token-info`, **Then**
   the system returns `400` with the standard error envelope rather than attempting to decode it.

---

### User Story 3 - Demonstrate 401 vs 403 and Role-Gated Access (Priority: P3)

A tester needs a single, unambiguous place to confirm the project's distinction between "not
authenticated" (401) and "authenticated but not authorized" (403), and to confirm that each of the
project's four roles is enforced correctly against role-specific demo endpoints.

**Why this priority**: Confusing 401 and 403 is one of the most common defects in real APIs;
CLAUDE.md calls this distinction out explicitly as something this endpoint must demonstrate before
any scope-based nuance is layered on top.

**Independent Test**: Can be fully tested by calling `GET /api/v1/protected` with no token (expect
401), with a token lacking the required role (expect 403), and with a token holding the required
role (expect 200); and by calling `GET /api/v1/role/{role}` with tokens of each of the four roles
against each of the four role endpoints.

**Acceptance Scenarios**:

1. **Given** no `Authorization` header, **When** the client calls `GET /api/v1/protected`,
   **Then** the system returns `401` with the standard error envelope.
2. **Given** a syntactically present but invalid, expired, or revoked token, **When** the client
   calls `GET /api/v1/protected`, **Then** the system returns `401` with the standard error
   envelope naming the specific reason (missing, malformed, expired, invalid signature, wrong
   issuer/audience, or revoked).
3. **Given** a valid token that does not hold the role required by `GET /api/v1/protected`,
   **When** the client calls it, **Then** the system returns `403` with the standard error envelope.
4. **Given** a valid token holding the required role, **When** the client calls
   `GET /api/v1/protected`, **Then** the system returns `200` with a body confirming the granted
   access and the identity's role.
5. **Given** a valid token for one of `user`, `admin`, `manager`, or `readonly`, **When** the
   client calls `GET /api/v1/role/{role}` for that same role, **Then** the system returns `200`.
6. **Given** a valid token for one role, **When** the client calls `GET /api/v1/role/{role}` for a
   *different* role, **Then** the system returns `403`.
7. **Given** a `role` path value that is not one of the four documented roles, **When** the client
   calls `GET /api/v1/role/{role}`, **Then** the system returns `400` with the standard error
   envelope rather than a false `403`/`404`.

---

### User Story 4 - Demonstrate Scope-Based Authorization (Priority: P4)

A tester needs to confirm that OAuth-style scopes are enforced independently of role, so that
tooling built against fine-grained scope checks (as opposed to coarse roles) has a reliable,
dedicated surface to validate against.

**Why this priority**: Scopes add a second, orthogonal authorization axis on top of roles;
CLAUDE.md requires a distinct `INSUFFICIENT_SCOPE` error condition, which is lower priority than
getting the core role/401-vs-403 story right but still required for full coverage of the auth
surface.

**Independent Test**: Can be fully tested by issuing tokens with different scope combinations via
`POST /auth/token` and calling `GET /api/v1/scope/{scope}` for each documented scope, confirming
`200` when the required scope is present and `403`/`INSUFFICIENT_SCOPE` when it is not.

**Acceptance Scenarios**:

1. **Given** a valid token carrying the scope required by a scope-gated demo endpoint, **When**
   the client calls it, **Then** the system returns `200`.
2. **Given** a valid token missing the required scope, **When** the client calls a scope-gated
   demo endpoint, **Then** the system returns `403` with the standard error envelope and
   `error.code` set to `INSUFFICIENT_SCOPE`, naming the missing scope.
3. **Given** a valid token carrying the `admin` scope, **When** the client calls any scope-gated
   demo endpoint regardless of its specific required scope, **Then** the system returns `200`
   (the `admin` scope satisfies every scope check).
4. **Given** a token carrying multiple scopes, **When** the client calls a demo endpoint requiring
   any one of them, **Then** the system returns `200`.

---

### Edge Cases

- What happens when the `Authorization` header is present but not in `Bearer <token>` form (wrong
  scheme, missing token, extra whitespace, duplicate header)? The system must return `401` with a
  reason indicating a malformed header, never a crash or a silent pass-through.
- What happens when a token's issuer or audience claim does not match the configured
  `JWT_ISSUER`/`JWT_AUDIENCE`? The system must return `401` with a reason distinguishing this from
  a plain signature failure.
- What happens when `POST /auth/login` is called with a well-formed but unknown username? The
  system must return the same `401` shape as a wrong password, never revealing whether the
  username exists.
- What happens when a refresh token is replayed a second time after already being rotated? The
  system must return `401`, treating the stale refresh token as revoked.
- What happens when `POST /auth/token` is called with a role or scope value that is not one of the
  documented roles/scopes? The system must return `400`/`422` with the standard error envelope.
- What happens when `POST /auth/logout` is called twice with the same token, or with a token that
  is already expired/invalid? The system must respond consistently (idempotent success for an
  already-revoked token from a prior logout; `401` for a token that was never valid) without
  crashing.
- What happens under repeated/high-frequency calls to `POST /auth/token` or `POST /auth/login`
  during load testing? Token issuance must remain lightweight (bounded computation, no external
  calls) so it does not become a load-test bottleneck in its own right.

## Requirements *(mandatory)*

### Functional Requirements

**Endpoints**

- **FR-001**: System MUST expose `POST /auth/login` accepting a username and password, returning
  an access token, a refresh token, the token type, and the access token's expiry on success.
- **FR-002**: System MUST expose `POST /auth/logout` accepting the caller's current access token
  and revoking it (and its associated refresh token) so neither can be used again.
- **FR-003**: System MUST expose `POST /auth/refresh` accepting a refresh token and returning a
  new access token (and a rotated refresh token), invalidating the previous refresh token.
- **FR-004**: System MUST expose `GET /auth/me` requiring a valid access token, returning the
  authenticated identity's user id, username, role, and scopes.
- **FR-005**: System MUST expose `POST /auth/token` allowing a caller to directly request a token
  for a given role and scope combination, and a `kind` of `valid`, `expired`, `invalid`, or
  `revoked`, without going through `POST /auth/login`. This endpoint MUST NOT require any
  authentication or authorization of its own caller — it is an unauthenticated test-support
  convenience, consistent with treating it as a peer of `POST /auth/login` rather than an
  admin-gated capability.
- **FR-006**: System MUST expose `GET /auth/token-info` accepting a token and returning its decoded
  claims plus a computed validity state (e.g. valid, expired, invalid-signature, wrong-issuer,
  wrong-audience, revoked, malformed), without requiring the token to still be usable elsewhere.
- **FR-007**: System MUST expose `GET /api/v1/protected` that requires both a valid, unrevoked
  token and a specific documented role, returning `401` when authentication fails and `403` when
  authentication succeeds but the role requirement is not met.
- **FR-008**: System MUST expose `GET /api/v1/role/{role}` for each of the four documented roles
  (`user`, `admin`, `manager`, `readonly`), returning `200` only when the caller's token role
  matches the path's role, `403` when it does not, and `400` when `role` is not one of the four
  documented values.
- **FR-009**: System MUST expose `GET /api/v1/scope/{scope}` for each of the seven documented
  scopes (`users:read`, `users:write`, `products:read`, `products:write`, `orders:read`,
  `orders:write`, `admin`), mirroring the `GET /api/v1/role/{role}` pattern: returning `200` when
  the caller's token carries the requested scope (or the `admin` scope) and `403` with
  `error.code` `INSUFFICIENT_SCOPE` otherwise, and `400` when `scope` is not one of the seven
  documented values.

**Token structure & configuration**

- **FR-010**: Access and refresh tokens MUST be signed JWTs whose signing secret, issuer, audience,
  and access-token expiry are sourced from configuration (`JWT_SECRET`, `JWT_ISSUER`,
  `JWT_AUDIENCE`, `JWT_EXPIRES_IN`), never hardcoded.
- **FR-011**: Every issued access token MUST carry, at minimum, a subject/user identifier, role,
  scopes, issuer, audience, issued-at, expiry, and a unique token identifier usable for
  revocation lookups.
- **FR-012**: Refresh tokens MUST be distinguishable from access tokens (e.g. a token-type claim)
  so that presenting a refresh token where an access token is expected is rejected, and vice versa.
- **FR-013**: The system MUST maintain a demo set of credentials, one per documented role, that
  `POST /auth/login` validates against; each demo account's username and role are discoverable
  from project documentation for testers, but its password is never echoed in any response.

**Validation & failure modes**

- **FR-014**: System MUST return `401` with the standard error envelope for every access-control
  failure related to authentication: missing token, malformed `Authorization` header, malformed
  JWT, expired token, invalid signature, wrong issuer, wrong audience, and revoked token — with
  `error.message` distinguishing the specific reason.
- **FR-015**: System MUST return `403` with the standard error envelope (and `INSUFFICIENT_SCOPE`
  as `error.code` for scope failures) for every access-control failure where the caller is
  authenticated but lacks the required role or scope.
- **FR-016**: System MUST return `400`/`422` with the standard error envelope for malformed
  request bodies on `POST /auth/login`, `POST /auth/token`, and `POST /auth/refresh` (missing
  required fields, wrong types, unknown `kind`/role/scope values) and for a malformed token on
  `GET /auth/token-info`, never a `500` or unhandled exception.
- **FR-017**: Revoking a token (via `POST /auth/logout` or issuing a `revoked`-kind token) MUST be
  reflected immediately and consistently across `GET /auth/token-info`, `GET /api/v1/protected`,
  and every role/scope-gated demo endpoint.

**Cross-cutting**

- **FR-018**: Every response produced by this feature, success or error, MUST include the
  `X-Request-ID` header; every error body MUST embed the same request id in the standard error
  envelope.
- **FR-019**: No response, log line, or error detail MUST ever contain a signing secret, a full
  password, or a full token value belonging to another request; `GET /auth/token-info` returns
  decoded claims about the token supplied in that same request only.
- **FR-020**: All behavior in this feature MUST be deterministic given the same configuration and
  inputs (aside from real wall-clock expiry), so automated test suites get identical outcomes on
  repeated runs.
- **FR-021**: Token issuance, verification, and revocation-list lookups MUST remain lightweight
  (bounded computation, no external calls, no unbounded in-memory growth) per the project's
  bounded-resource principle.

### Key Entities

- **Demo Account**: A seeded identity usable with `POST /auth/login`, with a username, password,
  one of the four documented roles, and a default scope set. Independent of the `users` CRUD
  resource introduced elsewhere.
- **Access Token**: A short-lived signed JWT representing an authenticated session; carries
  subject, role, scopes, issuer, audience, timestamps, and a unique identifier used for revocation.
- **Refresh Token**: A longer-lived signed JWT paired one-to-one with an access token's session,
  used only to obtain a new access token, rotated on each use.
- **Role**: One of `user`, `admin`, `manager`, `readonly` — a coarse-grained authorization label
  carried on a token.
- **Scope**: One of `users:read`, `users:write`, `products:read`, `products:write`,
  `orders:read`, `orders:write`, `admin` — a fine-grained, OAuth-style authorization label; a
  token may carry several, and `admin` satisfies any scope check.
- **Revocation Record**: An in-memory record of a token identifier (and its paired refresh token)
  that has been logged out or deliberately issued as pre-revoked, checked on every authenticated
  request.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A tester can complete the full login → identity-check → logout cycle, and confirm
  the logged-out token is rejected, in under four requests.
- **SC-002**: For each of the four convenience token kinds (valid, expired, invalid, revoked), an
  automated test can obtain the token and observe the correct accept/reject outcome and reason on
  the very next request, with 100% reproducibility across repeated runs.
- **SC-003**: Every combination of the four roles against the four role-demo endpoints, and every
  documented scope against its scope-demo endpoint, produces the expected `200`/`403` outcome with
  100% consistency across repeated runs.
- **SC-004**: 100% of authentication failures are distinguishable from authorization failures by
  status code alone (401 vs. 403) across every protected endpoint in this feature.
- **SC-005**: No response, log entry, or error body produced by this feature ever contains a raw
  signing secret or a caller's password, verified across the full endpoint surface.

## Assumptions

- **Demo credentials, not the CRUD `users` resource**: Because this spec depends only on Spec 001
  (foundation) and is explicitly parallelizable with the CRUD/catalog specs, `POST /auth/login`
  validates against a small, fixed set of seeded demo accounts (one per role) owned by this
  feature, not the `users` resource from Spec 002. Reconciling the two (e.g. letting CRUD users
  log in) is out of scope here.
- **CRUD resources remain unauthenticated for now**: Spec 002/003 resources (`users`, `products`,
  `orders`, `customers`, etc.) do not gain new auth requirements as a side effect of this spec;
  auth/role/scope enforcement is demonstrated on this feature's own dedicated endpoints
  (`/api/v1/protected`, `/api/v1/role/{role}`, scope-demo endpoints). Retrofitting real resources
  with scope checks, if desired, is a decision for a later spec.
- **Refresh token rotation**: each successful `POST /auth/refresh` invalidates the refresh token
  used and issues a new one, following standard refresh-rotation practice to keep replay windows
  small; this is a reasonable default since CLAUDE.md does not specify rotation policy explicitly.
- **Revocation store lifetime**: revoked token identifiers are held in-memory for the life of the
  running process; clearing this state is handled by the admin/reset feature (Spec 011), not by
  this spec.
- **`POST /auth/token` is a testing convenience, not a login bypass**: it is documented as a
  test-support endpoint for obtaining tokens in specific states without a real login, mirroring
  CLAUDE.md's explicit call for "convenience issuers"; it still validates its own input (role,
  scopes, kind) and never accepts an arbitrary signing secret from the caller.
- **Scope-demo endpoints are dedicated, not overlaid on CRUD**: each documented scope gets its own
  minimal demo endpoint (e.g. under this feature's own path space) purely to prove scope
  enforcement, consistent with the "CRUD stays unauthenticated for now" assumption above.
