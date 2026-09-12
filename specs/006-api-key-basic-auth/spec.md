# Feature Specification: API Key & Basic Auth

**Feature Branch**: `006-api-key-basic-auth`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 006 — API Key & Basic Auth"

## Clarifications

### Session 2026-09-12

- Q: When a tester revokes an API key, how should they submit the key to
  `POST /auth/api-key/revoke`? → A: Using the same `X-API-Key` header used by
  `GET /api-key/protected`, keeping a single consistent place clients put an API key value
  across every endpoint in this feature.
- Q: Should `POST /auth/api-key` let the caller specify a custom expiry (TTL) for a
  `kind: valid` key, instead of only the fixed `valid`/`expired`/`revoked` enum? → A: No —
  `kind` stays the only lever; a `valid` key never expires. This keeps the contract minimal and
  matches the JWT convenience-issuer pattern (`POST /auth/token`, Spec 005), which also has no
  custom TTL knob.
- Q: How many seeded demo username/password pairs should `GET /auth-test/basic` validate
  against? → A: One shared demo account. Basic Auth here exists to prove the mechanism itself
  (valid/invalid/missing/malformed), not to demonstrate roles — roles are already the JWT
  feature's job (Spec 005) — so a single account keeps the demo minimal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Issue and Use an API Key (Priority: P1)

A tester or automated testing tool requests a new API key, then presents it on a protected
endpoint via the `X-API-Key` header to confirm it grants access.

**Why this priority**: Without a working issue-then-use cycle, no other API-key scenario
(expiry, revocation, rejection) can be exercised. This is the entry point for every downstream
API-key flow.

**Independent Test**: Can be fully tested by calling `POST /auth/api-key` to obtain a key, then
calling `GET /api-key/protected` with that key in `X-API-Key` and confirming `200`.

**Acceptance Scenarios**:

1. **Given** no prior state, **When** the client calls `POST /auth/api-key`, **Then** the system
   returns `201` with a newly generated API key value, a key id, and the key's status
   (active) and issuance timestamp.
2. **Given** a freshly issued, active API key, **When** the client calls
   `GET /api-key/protected` with that key in the `X-API-Key` header, **Then** the system returns
   `200` with a body confirming the granted access and the key's id/label.
3. **Given** no `X-API-Key` header is present, **When** the client calls
   `GET /api-key/protected`, **Then** the system returns `401` with the standard error envelope
   indicating a missing key.
4. **Given** an `X-API-Key` value that was never issued by this system, **When** the client calls
   `GET /api-key/protected`, **Then** the system returns `401` with the standard error envelope
   indicating an invalid/unrecognized key.

---

### User Story 2 - Revoke an API Key (Priority: P2)

A tester revokes a previously issued API key and confirms it is rejected on every subsequent
use, so tooling can validate that key lifecycle management works end-to-end.

**Why this priority**: Revocation is the second half of the key lifecycle CLAUDE.md calls out
explicitly (`POST /auth/api-key/revoke`), and downstream specs (e.g. admin/reset) depend on
revocation being observable and immediate.

**Independent Test**: Can be fully tested by issuing a key, calling
`POST /auth/api-key/revoke` with it presented in the `X-API-Key` header, then calling
`GET /api-key/protected` with the same key and confirming `401`.

**Acceptance Scenarios**:

1. **Given** a valid, active API key presented in the `X-API-Key` header, **When** the client
   calls `POST /auth/api-key/revoke`, **Then** the system returns `200` confirming revocation.
2. **Given** an API key that was just revoked, **When** the client calls
   `GET /api-key/protected` with it, **Then** the system returns `401` with the standard error
   envelope indicating the key is revoked.
3. **Given** an API key that has already been revoked, **When** the client calls
   `POST /auth/api-key/revoke` with it again in the `X-API-Key` header, **Then** the system
   returns `200` idempotently rather than an error.
4. **Given** an API key value that was never issued by this system, presented in the
   `X-API-Key` header, **When** the client calls `POST /auth/api-key/revoke`, **Then** the system
   returns `404` with the standard error envelope.

---

### User Story 3 - Issue Purpose-Built Keys for Automated Testing (Priority: P3)

An automated test suite needs an API key that is already expired or already revoked, without
waiting for real time to pass or performing an extra revoke call, so it can assert rejection
behavior on demand and reproducibly.

**Why this priority**: CLAUDE.md calls out "expired" and "revoked" as first-class cases to cover
for API-key auth; mirroring the convenience-issuer pattern already established for JWTs (Spec
005) keeps this reproducible for automated regression and load-testing suites without depending
on that spec.

**Independent Test**: Can be fully tested by calling `POST /auth/api-key` with each documented
`kind` value (`valid`, `expired`, `revoked`) and confirming `GET /api-key/protected` reacts
correctly (accepted or rejected with the correct reason) for each.

**Acceptance Scenarios**:

1. **Given** a request for a `kind: expired` API key, **When** the client calls
   `POST /auth/api-key`, **Then** the system returns a key whose expiry is already in the past,
   and any subsequent use of it against `GET /api-key/protected` returns `401` with a reason
   indicating expiry.
2. **Given** a request for a `kind: revoked` API key, **When** the client calls
   `POST /auth/api-key`, **Then** the system returns a well-formed key that is already recorded
   as revoked, and any subsequent use of it returns `401` with a reason indicating revocation.
3. **Given** a request body with an unknown `kind` value, **When** the client calls
   `POST /auth/api-key`, **Then** the system returns `400`/`422` with the standard error envelope.

---

### User Story 4 - Demonstrate HTTP Basic Auth (Priority: P4)

A tester needs a single dedicated endpoint to confirm HTTP Basic Auth works correctly across
valid, invalid, missing, and malformed credential cases, independent of the JWT and API-key
mechanisms.

**Why this priority**: Basic Auth is the secondary auth mechanism CLAUDE.md lists alongside API
keys (#11); it is lower priority than the API-key surface because it exposes a single endpoint
rather than a full issue/revoke lifecycle.

**Independent Test**: Can be fully tested by calling `GET /auth-test/basic` with a valid demo
username/password pair (expect `200`), a wrong password (expect `401`), no `Authorization`
header (expect `401`), and a header that is not well-formed HTTP Basic (expect `401`).

**Acceptance Scenarios**:

1. **Given** a valid demo username/password encoded as HTTP Basic credentials, **When** the
   client calls `GET /auth-test/basic`, **Then** the system returns `200` with a body confirming
   the authenticated username.
2. **Given** a known username with the wrong password, or an unknown username, **When** the
   client calls `GET /auth-test/basic`, **Then** the system returns `401` with the standard error
   envelope, without revealing whether the username exists.
3. **Given** no `Authorization` header, **When** the client calls `GET /auth-test/basic`,
   **Then** the system returns `401` with the standard error envelope indicating missing
   credentials.
4. **Given** an `Authorization` header that is not valid HTTP Basic form (wrong scheme, invalid
   base64 payload, missing colon separator between username and password), **When** the client
   calls `GET /auth-test/basic`, **Then** the system returns `401` with the standard error
   envelope indicating malformed credentials, distinguishable from a wrong-password failure.

---

### Edge Cases

- What happens when `X-API-Key` is sent as an empty string, or with leading/trailing
  whitespace? The system must treat it as invalid/missing, never as a partial match against a
  stored key.
- What happens when `POST /auth/api-key/revoke` is called with a syntactically valid-looking but
  unissued key vs. a clearly malformed value in the `X-API-Key` header? Both must return `404`,
  never a `500` or a false `200`.
- What happens when `POST /auth/api-key/revoke` is called with no `X-API-Key` header at all? The
  system must return `401` (missing key), consistent with how `GET /api-key/protected` treats a
  missing header, rather than `404`.
- What happens when the same API key is revoked concurrently by two requests? Both requests must
  complete successfully (idempotent), and the key must end up revoked.
- What happens when `GET /auth-test/basic` receives duplicate `Authorization` headers, or a
  `Basic` payload whose decoded username or password contains a colon? The system must handle
  the first colon as the separator (per HTTP Basic Auth convention) and never crash on decode.
- What happens under repeated/high-frequency calls to `POST /auth/api-key` during load testing?
  Key issuance must remain lightweight (bounded computation, no external calls) so it does not
  become a load-test bottleneck in its own right.

## Requirements *(mandatory)*

### Functional Requirements

**Endpoints**

- **FR-001**: System MUST expose `POST /auth/api-key` accepting an optional `label` (a
  caller-supplied string identifying the key's purpose) and an optional `kind`
  (`valid` | `expired` | `revoked`, defaulting to `valid`), returning `201` with the generated key
  value, key id, label, status, issuedAt, and expiresAt (when applicable). `kind` is the only
  lever over the issued key's state; the endpoint accepts no separate custom-expiry/TTL field.
- **FR-002**: System MUST expose `POST /auth/api-key/revoke` accepting an API key value in the
  `X-API-Key` header (the same header used by `GET /api-key/protected`) and marking it revoked,
  returning `200` on success (including when the key was already revoked) and `404` when the key
  value was never issued by this system.
- **FR-003**: System MUST expose `GET /api-key/protected` requiring a valid, unexpired,
  unrevoked API key in the `X-API-Key` header, returning `200` with the key's id/label on success
  and `401` with a specific reason on every failure mode.
- **FR-004**: System MUST expose `GET /auth-test/basic` requiring HTTP Basic Auth credentials
  matching a seeded demo account, returning `200` with the authenticated username on success and
  `401` with a specific reason on every failure mode.

**API key structure & configuration**

- **FR-005**: Each issued API key MUST be an opaque, unguessable value unique across all
  currently- and previously-issued keys, distinct from any JWT or Basic Auth credential.
- **FR-006**: An API key issued with `kind: expired` MUST carry an expiry timestamp already in
  the past at issuance time; an API key issued with `kind: valid` MUST carry no expiry
  (`expiresAt: null`) and never expire on its own. No request field lets a caller set a custom
  expiry/TTL for a `valid` key.
- **FR-007**: An API key issued with `kind: revoked` MUST be recorded as revoked at issuance
  time, before any use.
- **FR-008**: The system MUST track, per API key, at minimum: key id, label, status (active,
  expired, revoked), issuedAt, and expiresAt (nullable).

**Basic Auth structure & configuration**

- **FR-009**: The system MUST maintain one seeded demo credential (a single username/password
  pair) for `GET /auth-test/basic`, independent of any credential store introduced by other
  auth features, discoverable from project documentation for testers; the password is never
  echoed in any response.

**Validation & failure modes**

- **FR-010**: System MUST return `401` with the standard error envelope for every
  `GET /api-key/protected` access failure — missing key, unrecognized key, expired key, revoked
  key — with `error.message` distinguishing the specific reason.
- **FR-011**: System MUST return `401` with the standard error envelope for every
  `GET /auth-test/basic` access failure — missing `Authorization` header, malformed Basic Auth
  encoding, unknown username, wrong password — with `error.message` distinguishing malformed
  credentials from a wrong-credential rejection.
- **FR-012**: System MUST return `400`/`422` with the standard error envelope for malformed
  `POST /auth/api-key` request bodies (wrong types, unknown `kind` value), never a `500` or
  unhandled exception.
- **FR-013**: Revoking an API key MUST be reflected immediately and consistently on every
  subsequent call to `GET /api-key/protected` with that key.

**Cross-cutting**

- **FR-014**: Every response produced by this feature, success or error, MUST include the
  `X-Request-ID` header; every error body MUST embed the same request id in the standard error
  envelope.
- **FR-015**: No response or log line MUST ever contain another request's raw API key value or
  Basic Auth password; `POST /auth/api-key` returns the generated key value only once, in its own
  response.
- **FR-016**: All behavior in this feature MUST be deterministic given the same configuration and
  inputs — including a `kind: valid` key, which per FR-006 never expires — so automated test
  suites get identical outcomes on repeated runs.
- **FR-017**: API key issuance, verification, and revocation lookups MUST remain lightweight
  (bounded computation, no external calls, no unbounded in-memory growth) per the project's
  bounded-resource principle.

### Key Entities

- **API Key**: An opaque credential presented via `X-API-Key`; carries a key id, label, status
  (active, expired, revoked), issuedAt, and expiresAt (nullable). Independent of JWT tokens and
  Basic Auth credentials.
- **Basic Auth Demo Credential**: The single seeded username/password pair usable with
  `GET /auth-test/basic`; owned by this feature, independent of the JWT demo accounts (Spec 005)
  and the `users` CRUD resource (Spec 002).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A tester can issue an API key and successfully call a protected endpoint with it in
  two requests.
- **SC-002**: For each API key state (missing, invalid, expired, revoked, valid), an automated
  test observes the correct `200`/`401` outcome and reason on the very next request, with 100%
  reproducibility across repeated runs.
- **SC-003**: Revoking an API key takes effect on the very next request against
  `GET /api-key/protected`, 100% of the time.
- **SC-004**: Every combination of valid/invalid/missing/malformed Basic Auth credentials against
  `GET /auth-test/basic` produces the expected `200`/`401` outcome with 100% consistency across
  repeated runs.
- **SC-005**: No response, log entry, or error body produced by this feature ever contains a raw
  API key value or Basic Auth password belonging to a different request, verified across the
  full endpoint surface.

## Assumptions

- **Independent demo credentials**: Because this spec depends only on Spec 001 and is explicitly
  parallelizable with Spec 005 (JWT), `GET /auth-test/basic` validates against its own single
  seeded demo account owned by this feature, not the demo accounts introduced by Spec 005 or the
  `users` resource from Spec 002.
- **API keys carry no role/scope**: Unlike JWTs, API keys are a flat allow/deny/expired/revoked
  mechanism with no role or scope claims, consistent with CLAUDE.md treating API-key auth as a
  simpler, secondary mechanism distinct from the JWT role/scope model.
- **Convenience `kind` parameter mirrors the JWT pattern**: `POST /auth/api-key` accepting a
  `kind` of `valid`/`expired`/`revoked` mirrors the convenience-issuer pattern already used by
  `POST /auth/token` (Spec 005), giving automated suites deterministic access to failure states
  without waiting on real time.
- **Key/credential store lifetime**: issued API keys and their revocation status are held
  in-memory for the life of the running process; clearing this state is handled by the
  admin/reset feature (Spec 011), not by this spec.
- **`POST /auth/api-key` is unauthenticated**: consistent with `POST /auth/token` in Spec 005,
  issuing a new API key requires no prior authentication of its own caller — this is a
  test-support convenience in a mock server, not a production credential-issuance system.
