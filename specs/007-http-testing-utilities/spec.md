# Feature Specification: HTTP Testing Utilities

**Feature Branch**: `007-http-testing-utilities`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 007 — HTTP Testing Utilities"

## Clarifications

### Session 2026-09-12

- Q: Should `POST /content/{type}` (the Content-Type-validation endpoint) actually be added as
  new scope, or should content-type validation be folded into an existing endpoint instead? → A:
  Keep the dedicated `POST /content/{type}` routes — they give "request Content-Type validation"
  a discoverable home right next to the `GET` demos, and exercise a real `415` scenario the
  project's status-code catalog documents but nothing else currently triggers organically.
- Q: Should the cookie endpoints manage a single fixed-name test cookie, or arbitrary
  caller-named cookies, possibly several at once? → A: Arbitrary caller-named cookies. `POST
  /cookies` sets whichever `{name, value}` pair the caller supplies without disturbing any other
  cookie already held; `GET /cookies` reports every cookie the client currently holds (however
  many); `DELETE /cookies` clears exactly one, by name. This mirrors how real browsers hold many
  independent cookies at once and supports more realistic multi-cookie test scenarios than a
  single fixed name would.
- Q: What exact response sizes should the small/medium/large payload presets target? → A: 1 KB /
  100 KB / 1 MB — round, easy-to-remember, order-of-magnitude steps that stay far below any
  realistic `MAX_PAYLOAD_SIZE` (default 10mb) while still giving a meaningfully large "large"
  case for testing tools.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Simulate Response Delay (Priority: P1)

A tester or load-testing tool requests a response that arrives only after a specified delay, to
verify how their client or system under test handles slow responses, timeouts, and latency
budgets.

**Why this priority**: Timeout and latency handling is one of the most common things automated
and performance-testing tools need to validate; CLAUDE.md calls this out as the first HTTP
testing utility, and it requires no other utility in this spec to be useful.

**Independent Test**: Can be fully tested by calling `GET /delay/{ms}` (or `GET /delay?ms=`) with
a small delay and measuring that the response arrives no sooner than the requested delay, then
calling it with a value exceeding the configured maximum and confirming immediate rejection.

**Acceptance Scenarios**:

1. **Given** a delay value within the configured maximum, **When** the client calls
   `GET /delay/{ms}`, **Then** the system waits at least that many milliseconds before returning
   `200` with a body confirming the requested and actual delay.
2. **Given** the same delay value supplied as `GET /delay?ms=`, **When** the client calls it,
   **Then** the system behaves identically to the path-parameter form.
3. **Given** a delay value of `0`, **When** the client calls `GET /delay/0`, **Then** the system
   returns `200` immediately without an artificial wait.
4. **Given** a delay value greater than the configured maximum, **When** the client calls
   `GET /delay/{ms}`, **Then** the system returns `400` immediately — never actually waiting the
   requested time.
5. **Given** a non-numeric, negative, decimal, empty, or missing delay value, **When** the client
   calls `GET /delay/{ms}` or `GET /delay?ms=`, **Then** the system returns `400` with the
   standard error envelope.

---

### User Story 2 - Generate Bounded Response Payloads (Priority: P2)

A tester requests a response body of a controllable size — a named preset or an explicit byte
count — to verify their client correctly handles small, medium, and large responses, without
risking the server's own memory.

**Why this priority**: Large-response handling is the second most common performance/negative
testing need CLAUDE.md calls out, independent of every other utility in this spec.

**Independent Test**: Can be fully tested by calling `GET /payload/{small|medium|large}` and
`GET /payload?size=` with values at, below, and above the configured maximum, and confirming the
returned body's size matches what was requested (or is rejected when over the maximum).

**Acceptance Scenarios**:

1. **Given** a request for the `small`, `medium`, or `large` preset, **When** the client calls
   `GET /payload/{preset}`, **Then** the system returns `200` with a JSON body whose serialized
   size matches that preset's documented target (`small` = 1 KB, `medium` = 100 KB, `large` =
   1 MB).
2. **Given** an explicit byte size within the configured maximum, **When** the client calls
   `GET /payload?size=`, **Then** the system returns `200` with a body of approximately that many
   bytes.
3. **Given** an explicit byte size greater than the configured maximum, **When** the client calls
   `GET /payload?size=`, **Then** the system returns `400` — never generating the oversized body.
4. **Given** a preset value that is not `small`, `medium`, or `large`, **When** the client calls
   `GET /payload/{preset}`, **Then** the system returns `400` with the standard error envelope.
5. **Given** a negative, non-numeric, or missing `size` value, **When** the client calls
   `GET /payload?size=`, **Then** the system returns `400`.

---

### User Story 3 - Echo Request Payloads (Priority: P3)

An automated test suite posts a request body — small, large, nested, or an array — and confirms
the server received it intact by checking a reported content length, so the suite can validate its
own request-construction logic end-to-end.

**Why this priority**: CLAUDE.md calls out payload echo as its own scenario distinct from
generating a response payload, covering the request side of payload testing; it depends on
nothing else in this spec.

**Independent Test**: Can be fully tested by posting bodies of increasing size and shape to
`POST /payload` and confirming the reported `contentLength` matches the actual request body size
in each case, plus confirming malformed and oversized bodies are rejected.

**Acceptance Scenarios**:

1. **Given** a small, well-formed JSON object body, **When** the client calls `POST /payload`,
   **Then** the system returns `200` with `{ "received": true, "contentLength": N }` where `N`
   equals the exact byte length of the request body.
2. **Given** a large, well-formed JSON body within the configured maximum, **When** the client
   calls `POST /payload`, **Then** the system returns `200` with the correct `contentLength`.
3. **Given** a deeply nested object or an array as the request body, **When** the client calls
   `POST /payload`, **Then** the system returns `200` with the correct `contentLength`, confirming
   structurally complex bodies are accepted like any other.
4. **Given** a body that is not valid JSON, **When** the client calls `POST /payload`, **Then**
   the system returns `400` with the standard error envelope, never a crash.
5. **Given** a request body larger than the configured maximum payload size, **When** the client
   calls `POST /payload`, **Then** the system rejects it with `413` rather than buffering the
   entire oversized body into memory.

---

### User Story 4 - Demonstrate Content Types (Priority: P4)

A tester requests a response in a specific content type (JSON, plain text, HTML, or XML) to
verify their client correctly parses and negotiates each format, and confirms the server rejects
a request whose declared `Content-Type` doesn't match what an endpoint expects.

**Why this priority**: Content-type diversity and negotiation is a distinct, commonly-needed
testing scenario per CLAUDE.md, independent of delay/payload-size/echo/headers/cookies.

**Independent Test**: Can be fully tested by calling `GET /content/{json|text|html|xml}` and
confirming each returns the correct `Content-Type` header and a validly-formatted body, then
posting to the same paths with a mismatched `Content-Type` request header and confirming
rejection.

**Acceptance Scenarios**:

1. **Given** a request for `json`, **When** the client calls `GET /content/json`, **Then** the
   system returns `200` with `Content-Type: application/json` and a well-formed JSON body.
2. **Given** a request for `text`, **When** the client calls `GET /content/text`, **Then** the
   system returns `200` with `Content-Type: text/plain` and a plain-text body.
3. **Given** a request for `html`, **When** the client calls `GET /content/html`, **Then** the
   system returns `200` with `Content-Type: text/html` and a well-formed HTML body.
4. **Given** a request for `xml`, **When** the client calls `GET /content/xml`, **Then** the
   system returns `200` with `Content-Type: application/xml` and a well-formed XML body.
5. **Given** a `type` value that is not one of the four documented types, **When** the client
   calls `GET /content/{type}`, **Then** the system returns `400` rather than a false `404`.
6. **Given** a request body posted to `POST /content/{type}` whose `Content-Type` header matches
   that type's expected media type, **When** the client calls it, **Then** the system returns
   `200` confirming acceptance.
7. **Given** a request body posted to `POST /content/{type}` whose `Content-Type` header does
   *not* match that type's expected media type, **When** the client calls it, **Then** the system
   returns `415` with the standard error envelope.

---

### User Story 5 - Echo Safe Request Headers (Priority: P5)

A tester sends a request with a mix of ordinary and sensitive headers and confirms exactly which
headers the server received, while verifying that sensitive headers are never echoed back.

**Why this priority**: Header visibility is a lower-stakes but still explicitly-required testing
utility (CLAUDE.md #18), independent of every other scenario in this spec.

**Independent Test**: Can be fully tested by calling `GET /headers` with a mix of ordinary and
sensitive headers (`Authorization`, `Cookie`, `X-API-Key`) and confirming the response body
includes the ordinary ones and excludes the sensitive ones.

**Acceptance Scenarios**:

1. **Given** a request with several ordinary custom headers, **When** the client calls
   `GET /headers`, **Then** the system returns `200` with a body listing those headers and their
   values exactly as sent.
2. **Given** a request including `Authorization`, `Cookie`, and/or `X-API-Key` headers, **When**
   the client calls `GET /headers`, **Then** the response body never includes those headers or
   their values.
3. **Given** a request with no custom headers at all, **When** the client calls `GET /headers`,
   **Then** the system returns `200` with whatever safe headers the client/runtime sent by
   default (e.g. `host`, `user-agent`, `accept`), never an error.

---

### User Story 6 - Manage Cookies (Priority: P6)

A tester sets a cookie, confirms the server can read it back on a subsequent request, and clears
it, to verify their client's cookie-jar behavior end-to-end.

**Why this priority**: Cookie handling is the last of CLAUDE.md's explicitly listed HTTP testing
utilities and is independent of every other scenario here.

**Independent Test**: Can be fully tested by calling `POST /cookies` to set a named cookie,
`GET /cookies` (with that cookie resent by the client) to confirm it's readable, and
`DELETE /cookies` to clear it, then confirming a subsequent `GET /cookies` no longer reports it.

**Acceptance Scenarios**:

1. **Given** no cookies have been set, **When** the client calls `GET /cookies`, **Then** the
   system returns `200` with an empty cookie map.
2. **Given** a request body naming an arbitrary cookie and value, **When** the client calls
   `POST /cookies`, **Then** the system returns `200` and a `Set-Cookie` header for that
   name/value, without disturbing any other cookie the client already holds.
3. **Given** two or more cookies previously set (via separate `POST /cookies` calls) and resent
   by the client, **When** the client calls `GET /cookies`, **Then** the system returns `200`
   with every one of those cookies' names and values in the response body — not just the most
   recently set one.
4. **Given** one of several previously-set cookies, **When** the client calls `DELETE /cookies`
   naming it, **Then** the system returns `200` and a `Set-Cookie` header that expires/clears only
   that named cookie, and a subsequent `GET /cookies` (once the client drops the expired cookie)
   no longer reports it while still reporting every other cookie the client holds.
5. **Given** a `POST /cookies` or `DELETE /cookies` request missing the required cookie name,
   **When** the client calls it, **Then** the system returns `400` with the standard error
   envelope.

---

### Edge Cases

- What happens when `GET /delay/{ms}` receives a fractional value (e.g. `100.5`) or a value with
  leading/trailing whitespace? The system must return `400`, never silently truncating or
  rounding.
- What happens under many concurrent `GET /delay/{ms}` calls during load testing? Each delayed
  request must only hold its own lightweight timer — no per-request unbounded memory or CPU work
  — so a burst of delayed requests doesn't itself become the bottleneck.
- What happens when `GET /payload?size=0` is requested? The system must return `200` with an
  empty or minimal body, not an error.
- What happens when `POST /payload` receives an empty body? The system must return `200` with
  `contentLength: 0`, not `400`.
- What happens when `POST /payload` receives a body with an unexpected `Content-Type` (e.g.
  `text/plain` containing JSON)? The system must still validate the body can be parsed as JSON
  per FR-010, returning `400` if it cannot.
- What happens when `GET /headers` is called with duplicate header names? The system must report
  them as Node/Express itself folds them (comma-joined for most headers), never crash on the
  shape.
- What happens when `POST /cookies` is called with a cookie value containing characters that
  need encoding (e.g. spaces, semicolons)? The system must encode/decode the value safely and
  round-trip it without corruption.
- What happens when `DELETE /cookies` is called for a cookie that was never set? The system must
  still return `200` (idempotent), never `404`.

## Requirements *(mandatory)*

### Functional Requirements

**Delay**

- **FR-001**: System MUST expose `GET /delay/{ms}` and `GET /delay?ms=`, delaying the response by
  the requested number of milliseconds before returning `200` with a body confirming the
  requested delay.
- **FR-002**: System MUST reject any delay value greater than a configurable maximum with `400`,
  immediately, without waiting any portion of the requested delay.
- **FR-003**: System MUST reject a non-numeric, negative, decimal, empty, or missing delay value
  with `400`.

**Payload size (response generation)**

- **FR-004**: System MUST expose `GET /payload/{small|medium|large}` and `GET /payload?size=`,
  returning a generated body whose size matches the requested preset (`small` = 1 KB, `medium` =
  100 KB, `large` = 1 MB) or explicit byte count.
- **FR-005**: System MUST reject an explicit `size` greater than a configurable maximum with
  `400`, never generating the oversized body.
- **FR-006**: System MUST reject a `preset` value that is not `small`, `medium`, or `large` with
  `400`, and a negative, non-numeric, or missing `size` value with `400`.

**Payload echo (request ingestion)**

- **FR-007**: System MUST expose `POST /payload`, returning `200` with
  `{ "received": true, "contentLength": N }` where `N` is the exact byte length of the request
  body, for any well-formed JSON body regardless of shape (object, array, nested, empty).
- **FR-008**: System MUST reject a request body that is not valid JSON with `400`.
- **FR-009**: System MUST reject a request body larger than the configurable maximum payload size
  with `413`, without buffering the full oversized body into memory.

**Content types**

- **FR-010**: System MUST expose `GET /content/{json|text|html|xml}`, returning `200` with the
  matching `Content-Type` header (`application/json`, `text/plain`, `text/html`,
  `application/xml` respectively) and a validly-formatted body of that type.
- **FR-011**: System MUST reject a `type` value that is not one of the four documented types with
  `400`.
- **FR-012**: System MUST expose `POST /content/{json|text|html|xml}`, returning `200` when the
  request's `Content-Type` header matches that type's expected media type, and `415` when it does
  not.

**Headers**

- **FR-013**: System MUST expose `GET /headers`, returning `200` with a body listing every
  incoming request header and its value, **except** `Authorization`, `Cookie`, `X-API-Key`, and
  any other header this project treats as secret-bearing, which MUST always be excluded.

**Cookies**

- **FR-014**: System MUST expose `GET /cookies`, returning `200` with a map of every cookie
  present on the request (empty if none), supporting an arbitrary number of simultaneously-held,
  independently-named cookies — not just the single most-recently-set one.
- **FR-015**: System MUST expose `POST /cookies`, accepting an arbitrary caller-supplied cookie
  name and value, setting it via a `Set-Cookie` response header without disturbing any other
  cookie the client already holds, and returning `200` confirming the name/value set.
- **FR-016**: System MUST expose `DELETE /cookies`, accepting a cookie name, clearing only that
  named cookie via an expiring `Set-Cookie` response header (leaving every other cookie intact),
  and returning `200` — idempotently, even if that cookie was never set.
- **FR-017**: System MUST reject a `POST /cookies` or `DELETE /cookies` request missing the
  required cookie name with `400`.

**Cross-cutting**

- **FR-018**: Every response produced by this feature, success or error, MUST include the
  `X-Request-ID` header; every error body MUST embed the same request id in the standard error
  envelope.
- **FR-019**: Every configurable maximum introduced or reused by this feature (delay, payload
  size) MUST be sourced from environment configuration, never hardcoded, and MUST bound
  caller-supplied values rather than accepting them unbounded.
- **FR-020**: All behavior in this feature MUST be deterministic given the same configuration and
  inputs (aside from the deliberate, bounded wait introduced by `GET /delay/{ms}` itself), so
  automated test suites get identical outcomes on repeated runs.
- **FR-021**: None of this feature's endpoints MUST perform an external network call or
  unbounded computation; every endpoint's resource usage MUST be bounded by its own configured
  maximum, per the project's bounded-resource principle.

### Key Entities

- **Delay Request**: A caller-supplied millisecond duration, validated against a configurable
  maximum; not persisted, exists only for the duration of one request.
- **Payload Size Preset**: One of `small` (1 KB), `medium` (100 KB), `large` (1 MB) — each mapping
  to a fixed, documented response size.
- **Content Type Demo**: One of `json`, `text`, `html`, `xml` — each with a fixed expected
  response `Content-Type` and a matching example body.
- **Header Echo**: The set of incoming request headers minus a fixed safe-list exclusion of
  secret-bearing header names.
- **Cookie**: A client-held name/value pair set, read, and cleared via `Set-Cookie`/`Cookie`
  headers; never stored server-side.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A tester can request any delay from `0` up to the configured maximum and receive a
  response no sooner than that delay, with 100% of requests exceeding the maximum rejected
  immediately rather than after waiting.
- **SC-002**: Every payload-size preset and every explicit in-bounds byte size produces a
  response body within a small, consistent tolerance of the requested size, with 100% of
  over-maximum requests rejected before any oversized body is generated.
- **SC-003**: 100% of well-formed `POST /payload` request bodies — regardless of size (within the
  maximum) or structure (object, array, nested) — receive back an exactly accurate
  `contentLength`.
- **SC-004**: Each of the four documented content types is returned with the correct
  `Content-Type` header and a valid body 100% of the time, and 100% of mismatched-Content-Type
  `POST` requests to the same paths are rejected.
- **SC-005**: 100% of `GET /headers` responses, across arbitrary injected headers, never contain
  the value of `Authorization`, `Cookie`, or `X-API-Key`.
- **SC-006**: A tester can complete a full set → read-back → clear cookie cycle in three
  requests, with 100% consistency across repeated runs.

## Assumptions

- **No authentication required**: Every endpoint in this feature is a generic, stateless HTTP
  testing utility with no auth requirement, consistent with how Specs 001-004's non-resource
  utility endpoints (health, version, status codes) are also unauthenticated.
- **Top-level paths, no `/api/v1` prefix**: `/delay`, `/payload`, `/content`, `/headers`, and
  `/cookies` are mounted top-level, exactly as CLAUDE.md spells them (without the versioned API
  prefix), mirroring how `/auth/*`, `/api-key/*`, and `/auth-test/*` are also top-level.
- **Reused configuration, no new environment variables**: `MAX_DELAY_MS` and `MAX_PAYLOAD_SIZE`
  already exist in configuration from Spec 001 and are reused as-is for this feature's bounds; no
  new `.env` keys are introduced.
- **Payload size presets are fixed, documented sizes**: `small` = 1 KB, `medium` = 100 KB, and
  `large` = 1 MB (confirmed in Clarifications) — round, order-of-magnitude steps that stay
  comfortably under any realistic `MAX_PAYLOAD_SIZE` (default 10mb), documented for testers, not
  independently configurable.
- **`POST /content/{type}` is a deliberately-added, dedicated home for Content-Type validation**:
  confirmed in Clarifications above — CLAUDE.md pairs content-type demonstration with a
  request-side Content-Type validation requirement but names no path for it, so this spec adds a
  `POST` variant of the same path family rather than leaving it as an abstract, untestable
  requirement.
- **Cookies are client-held state only, never stored server-side**: an arbitrary number of
  independently-named cookies may exist at once (confirmed in Clarifications); `GET /cookies`
  only ever reports what the client itself resent, matching standard HTTP cookie semantics — this
  feature keeps no cookie registry of its own.
