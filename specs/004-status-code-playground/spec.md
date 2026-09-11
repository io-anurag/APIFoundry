# Feature Specification: Status Code Playground

**Feature Branch**: `004-status-code-playground`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 004 — Status Code Playground"

## Clarifications

### Session 2026-09-12

- Q: Should a `code` value with leading zeros or surrounding whitespace (e.g. `0200`, ` 200 `) be normalized to the equivalent status code, or rejected as malformed? → A: Rejected as malformed — any leading zero, whitespace, or other non-strict-integer formatting in `code` returns `400`, matching this project's precedent of strict identifier-format validation.
- Q: What is the exact boundary between the "huge" malformed `code` case (FR-011) and the "well-formed but undocumented" `code` case (FR-012, e.g. `418`)? → A: The standard 3-digit HTTP status code range (100–599) is the boundary — any `code` outside that range is "huge"/malformed; any 3-digit value inside it but not in the documented list is "unsupported."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exercise Every Documented Status Code (Priority: P1)

An automated testing tool or QA engineer requests each of the documented HTTP status codes from a
single, dedicated endpoint to confirm the server can produce the exact status line, headers, and
body semantics for every code their test suite needs to assert against — without needing to find
or construct a real scenario that happens to trigger that code elsewhere in the API.

**Why this priority**: This is the entire purpose of the feature. Every other behavior (validation,
determinism) exists in service of making each documented code reliably reproducible on demand.

**Independent Test**: Can be fully tested by issuing `GET /api/v1/status/{code}` for each of the 24
documented codes and confirming the response's status line, headers (`Location` for redirects,
`Allow` for 405, `Retry-After` for 429), and body shape match that code's documented semantics.

**Acceptance Scenarios**:

1. **Given** any of the documented 2xx codes (200, 201, 202), **When** a client requests
   `GET /api/v1/status/{code}`, **Then** the system returns that exact status with a JSON body
   describing the demonstrated code.
2. **Given** the 204 code, **When** requested, **Then** the system returns status 204 with no
   response body, matching HTTP semantics that forbid a body on that status.
3. **Given** the 301 or 302 code, **When** requested, **Then** the system returns that exact status
   with a `Location` header pointing to a harmless, documented target and a small JSON body
   describing the redirect for clients that do not auto-follow it.
4. **Given** the 304 code, **When** requested, **Then** the system returns status 304 with no
   response body.
5. **Given** any documented 4xx or 5xx code, **When** requested, **Then** the system returns that
   exact status using the project's standard error envelope, with `error.code` naming the
   demonstrated condition.
6. **Given** the 405 code, **When** requested, **Then** the response includes an `Allow` header.
7. **Given** the 429 code, **When** requested, **Then** the response includes a `Retry-After`
   header.
8. **Given** the same documented code requested repeatedly, **When** compared across requests,
   **Then** the status, headers, and body are identical every time (aside from the per-request
   `X-Request-ID`).

---

### User Story 2 - Reject Malformed Code Values Safely (Priority: P2)

A tester sends malformed values in place of a valid status code — non-numeric text, a negative
number, zero, an empty segment, a decimal, or an unreasonably large number — to confirm the
endpoint validates input defensively instead of crashing or returning a misleading status.

**Why this priority**: CLAUDE.md requires deliberate per-ID edge-case coverage (malformed,
negative, zero, huge, empty) for every path parameter in the project, and a malformed value here is
especially easy to mistake for a "successful" demonstration of some unrelated status if not
validated explicitly.

**Independent Test**: Can be fully tested by issuing `GET /api/v1/status/{code}` with a table of
malformed values and confirming every one returns `400` with the standard error envelope rather
than a crash, a `404`, or an accidental pass-through status.

**Acceptance Scenarios**:

1. **Given** a non-numeric `code` value (e.g. `abc`), **When** requested, **Then** the system
   returns `400` with the standard error envelope.
2. **Given** a negative, zero, decimal, or empty `code` value, **When** requested, **Then** the
   system returns `400` with the standard error envelope.
3. **Given** an unreasonably large numeric `code` value (e.g. far beyond any valid HTTP status
   range), **When** requested, **Then** the system returns `400` with the standard error envelope,
   never a server error.

---

### User Story 3 - Reject Well-Formed but Unsupported Codes (Priority: P3)

A tester requests a syntactically valid integer that falls in the general HTTP status code range
but is not one of the codes this feature documents (e.g. `418`), to confirm the endpoint's surface
stays exactly matched to what it documents rather than silently accepting arbitrary values.

**Why this priority**: Lower priority than the core demonstration and malformed-input handling, but
still required so the documented endpoint list and its actual behavior never drift apart, per the
project's spec-parity requirement.

**Independent Test**: Can be fully tested by requesting a handful of valid-looking but undocumented
status codes and confirming each is rejected the same explicit way rather than passed through.

**Acceptance Scenarios**:

1. **Given** a numeric `code` value that is a plausible HTTP status but not in this feature's
   documented list, **When** requested, **Then** the system returns `400` with the standard error
   envelope naming the code as unsupported.

---

### Edge Cases

- What happens when `code` is supplied with leading zeros or surrounding whitespace (e.g. `0200`,
  ` 200 `)? The system must reject it as malformed and return `400`, the same as any other
  non-strict-integer formatting, rather than normalizing it to the intended code.
- What happens when the same code is requested with different query strings appended? Query
  parameters have no defined effect on this endpoint; the response must be identical to the same
  request without a query string.
- What happens when a client that auto-follows redirects requests 301 or 302? It must land on the
  redirect target successfully rather than looping or reaching a broken URL.
- What happens under repeated/high-frequency requests to this endpoint (e.g. during load testing)?
  The endpoint must remain lightweight and respond without artificial delay or unbounded resource
  use, per the project's bounded-resource principle.

## Requirements *(mandatory)*

### Functional Requirements

**Coverage**

- **FR-001**: System MUST expose `GET /api/v1/status/{code}` supporting exactly the following
  documented codes: 200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405, 406, 408, 409, 410,
  415, 422, 429, 500, 501, 502, 503, 504.

**Per-status-class semantics**

- **FR-002**: For 200, 201, and 202, the system MUST return that exact status with a JSON body
  describing the demonstrated code (at minimum, the numeric code and a human-readable description).
- **FR-003**: For 204, the system MUST return that exact status with no response body.
- **FR-004**: For 301 and 302, the system MUST return that exact status with a `Location` header
  pointing to a harmless, documented target within this endpoint's own surface, plus a small JSON
  body describing the redirect for clients that do not auto-follow it.
- **FR-005**: For 304, the system MUST return that exact status with no response body.
- **FR-006**: For every documented 4xx and 5xx code (400, 401, 403, 404, 405, 406, 408, 409, 410,
  415, 422, 429, 500, 501, 502, 503, 504), the system MUST return that exact status using the
  project's standard error envelope, with `error.code` naming the demonstrated condition and
  `error.message` describing it in plain language.
- **FR-007**: The 405 response MUST include an `Allow` header naming at least one HTTP method.
- **FR-008**: The 429 response MUST include a `Retry-After` header.
- **FR-009**: The 401 and 403 demonstrations MUST NOT require or reference any real credential,
  token, or session — they demonstrate the response shape only, independent of the project's actual
  authentication mechanisms (introduced in later specs).

**Validation**

- **FR-010**: System MUST return `400` with the standard error envelope when `code` is malformed:
  non-numeric, decimal, negative, zero, empty, or containing leading zeros or surrounding
  whitespace (no normalization is performed on any of these forms).
- **FR-011**: System MUST return `400` with the standard error envelope when `code` is an integer
  outside the standard HTTP status code range of 100–599 (the "huge"/out-of-range case), without
  attempting to process it further.
- **FR-012**: System MUST return `400` with the standard error envelope — naming the code as
  unsupported — when `code` is a syntactically valid integer within the 100–599 range that is not
  one of the codes listed in FR-001 (e.g. `418`), rather than returning `404` or silently passing it
  through.

**Cross-cutting**

- **FR-013**: Every response produced by this endpoint, success or error, MUST include the
  `X-Request-ID` header; every error body MUST embed the same request ID in the standard error
  envelope.
- **FR-014**: Behavior MUST be fully deterministic: repeated requests for the same `code`, on a
  freshly started or long-running server, MUST return identical status, headers, and body (aside
  from the per-request `X-Request-ID`).
- **FR-015**: The endpoint MUST remain lightweight per the project's bounded-resource principle: no
  artificial delay, no external calls, and no large or unbounded payload generation.
- **FR-016**: The endpoint MUST require no authentication.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the 24 documented status codes, an automated client receives the exact
  status code with correct semantic headers and body shape on every request, 100% of the time.
- **SC-002**: Every malformed or out-of-range `code` value in the edge-case matrix (non-numeric,
  negative, zero, decimal, empty, unreasonably large, well-formed-but-undocumented) returns a
  structured `400` without ever crashing the server, 100% of the time.
- **SC-003**: Repeated requests to the same documented code return byte-identical status, headers,
  and body (excluding the request id) across the life of a server run, confirming full determinism.
- **SC-004**: Requests to this endpoint complete with no perceptible processing delay, consistent
  with the project's lightweight, load-testable endpoint design.

## Assumptions

- **Path-parameter form only**: CLAUDE.md documents this feature as `GET /api/v1/status/{code}`
  only (unlike `/delay` or `/payload`, which explicitly document both a path and a query-string
  form); no `?code=` query-string alternative is introduced here.
- **Redirect target**: 301/302 responses redirect to this same endpoint's 200 demonstration URL
  (`/api/v1/status/200`), so automated redirect-following clients land somewhere harmless and
  documented rather than an unrelated or external resource.
- **304 is unconditional, not negotiated**: this feature returns 304 as a fixed demonstration of
  that status's semantics (no body). Real conditional-request negotiation via `ETag`/
  `If-None-Match`/`Last-Modified` is introduced separately by Spec 008's `/cache/resource` endpoint
  and is out of scope here.
- **429 has no real rate-limit state**: the `Retry-After` header on the 429 demonstration is a
  fixed, documented value; this endpoint does not track or enforce request counts (real rate
  limiting is introduced separately by Spec 008's `/rate-limit` endpoint).
- **No new resource or auth surface**: this feature introduces no data entities and no
  authentication requirement; it depends only on Spec 001's foundation (config, error envelope,
  request-id middleware).
