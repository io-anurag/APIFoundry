# Feature Specification: Error Simulation & Generic Scenario Endpoint

**Feature Branch**: `010-error-simulation-scenario-endpoint`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 010 — Error Simulation & Generic Scenario Endpoint"

## Clarifications

### Session 2026-09-12

- Q: When `status=...` targets a code that can't carry a normal JSON body or needs extra data
  (`204`, `304`, `301`/`302`), should `GET /api/v1/test` support it? → A: Yes — support the full
  documented set of status-code-playground values, reusing Spec 004's exact per-code response
  construction for each (empty body for `204`/`304`, `Location` header for redirects), so the
  endpoint can genuinely reach any documented status.
- Q: How large should the `scenario=large-response` body actually be? → A: Reuse Spec 007's
  existing "large" payload preset exactly (the same size `GET /payload/large` returns), bounded by
  `MAX_PAYLOAD_SIZE`, rather than defining a second, independent notion of "large" for the server.
- Q: Precisely when do `scenario` and `status` "conflict" and get rejected with `400`, versus being
  allowed together? → A: Only when `status` differs from the named scenario's own fixed status code
  — e.g. `scenario=not-found&status=404` is allowed (redundant, same outcome as `scenario` alone),
  while `scenario=not-found&status=400` is rejected as conflicting. A scenario with no fixed status
  of its own (`success`, `delayed`, `large-response`) never conflicts with `status`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger a Specific Error Deterministically (Priority: P1)

A tester writes an automated assertion that checks their client's error-handling code path for one
specific failure mode (e.g. "does my client retry on `503`?") by calling one dedicated endpoint that
always returns exactly that outcome, with no flags, randomness, or setup required.

**Why this priority**: These are the simplest, most foundational building blocks in this spec
(CLAUDE.md #25) and require no query-parameter logic — every other capability in this spec composes
scenarios on top of the same status/error-code mappings these endpoints establish.

**Independent Test**: Can be fully tested by calling each of `GET /errors/validation`,
`/errors/not-found`, `/errors/conflict`, `/errors/unauthorized`, `/errors/forbidden`,
`/errors/rate-limit`, `/errors/server-error`, `/errors/service-unavailable`, and `/errors/timeout`
in isolation and confirming each always returns its documented status and error code, with no
setup and no dependency on any other endpoint.

**Acceptance Scenarios**:

1. **Given** no special headers or query parameters, **When** the client calls `GET /errors/validation`,
   **Then** the system returns `400` with the standard error envelope carrying a `VALIDATION_ERROR` code.
2. **Given** no special headers or query parameters, **When** the client calls `GET /errors/not-found`,
   **Then** the system returns `404` with a `RESOURCE_NOT_FOUND` code.
3. **Given** no special headers or query parameters, **When** the client calls `GET /errors/conflict`,
   **Then** the system returns `409` with a `CONFLICT` code.
4. **Given** any `Authorization` header (present, absent, or invalid), **When** the client calls
   `GET /errors/unauthorized`, **Then** the system always returns `401` with an `UNAUTHORIZED` code,
   regardless of the credentials supplied.
5. **Given** any credentials (including a fully valid token), **When** the client calls
   `GET /errors/forbidden`, **Then** the system always returns `403` with a `FORBIDDEN` code.
6. **Given** no special headers or query parameters, **When** the client calls `GET /errors/rate-limit`,
   **Then** the system returns `429` with a `Retry-After` header and a `RATE_LIMIT_EXCEEDED` code,
   without consuming or affecting the real rate-limit counters used by `GET /rate-limit`.
7. **Given** no special headers or query parameters, **When** the client calls `GET /errors/server-error`,
   **Then** the system returns `500` with an `INTERNAL_ERROR` code.
8. **Given** no special headers or query parameters, **When** the client calls
   `GET /errors/service-unavailable`, **Then** the system returns `503` with a `SERVICE_UNAVAILABLE` code.
9. **Given** no special headers or query parameters, **When** the client calls `GET /errors/timeout`,
   **Then** the system immediately returns `408` with a `REQUEST_TIMEOUT` code, without holding the
   connection open.
10. **Given** repeated calls to any single `/errors/*` endpoint, **When** compared across many calls,
    **Then** the returned status and error code are identical every time.

---

### User Story 2 - Drive an End-to-End Test Flow Through One Configurable Endpoint (Priority: P2)

A tester (or an automated k6 script chaining multiple steps together) calls a single endpoint with a
`scenario` query parameter to obtain whichever outcome the current test step needs — success or one
of the standard failure modes — without switching between many different endpoint paths.

**Why this priority**: This is the primary consumer-facing capability of this spec (CLAUDE.md #26,
explicitly called out as "the primary k6 hook") and delivers the core value of the generic scenario
endpoint; it depends on the status/error-code mappings established by User Story 1 but adds no
timing or payload-size behavior yet.

**Independent Test**: Can be fully tested by calling `GET /api/v1/test?scenario=success` (expect
`200`), then each of `scenario=validation-error`, `unauthorized`, `forbidden`, `not-found`,
`conflict`, `rate-limit`, `server-error`, `service-unavailable`, and `timeout` in turn, confirming
each returns the matching status/error code, and confirming an unrecognized `scenario` value
returns a `400` validation error rather than an arbitrary or crashing response.

**Acceptance Scenarios**:

1. **Given** `scenario=success` (or the parameter omitted), **When** the client calls
   `GET /api/v1/test`, **Then** the system returns `200` with a body describing the scenario that ran.
2. **Given** `scenario=validation-error`, **When** the client calls `GET /api/v1/test`, **Then** the
   system returns `400` with a `VALIDATION_ERROR` code.
3. **Given** `scenario=unauthorized`, `forbidden`, `not-found`, `conflict`, `rate-limit`,
   `server-error`, `service-unavailable`, or `timeout`, **When** the client calls `GET /api/v1/test`,
   **Then** the system returns the same status and error code as the matching `/errors/*` endpoint
   from User Story 1.
4. **Given** an unrecognized or misspelled `scenario` value, **When** the client calls
   `GET /api/v1/test`, **Then** the system returns `400` with a `VALIDATION_ERROR` code listing the
   supported scenario names, rather than defaulting silently to success.
5. **Given** an explicit `status` query parameter matching one of the values documented by the
   status-code playground (CLAUDE.md #6), **When** the client calls `GET /api/v1/test` without a
   `scenario` recognized above (or with `scenario=success`), **Then** the system returns that exact
   status code with a body appropriate to it, letting a caller reach any documented status without
   memorizing a scenario name for it.
6. **Given** a `scenario` value with its own fixed status code (e.g. `not-found`) and a `status`
   value that differs from it (e.g. `400`), **When** the client calls `GET /api/v1/test`, **Then**
   the system returns `400` with a `VALIDATION_ERROR` code explaining the conflict, rather than
   silently preferring one parameter. A `status` equal to the scenario's own fixed code (e.g.
   `scenario=not-found&status=404`) MUST be accepted as redundant and behave exactly as `scenario`
   alone.

---

### User Story 3 - Compose Timing, Payload Size, and Failure Probability Into a Test Step (Priority: P3)

A performance or chaos-testing script uses the same generic endpoint to also inject latency, request
a large response body, or make a failure scenario occur only a configurable fraction of the time —
all through optional parameters on the same call used in User Story 2 — so one endpoint can stand in
for an entire step of a realistic upstream dependency.

**Why this priority**: This composes the timing/payload behaviors already introduced by Spec 007
and the probabilistic-failure behavior already introduced by Spec 008 onto the scenario endpoint;
it depends on User Story 2's scenario dispatch but is independently testable and not required for
the endpoint's basic error-simulation value.

**Independent Test**: Can be fully tested by calling `GET /api/v1/test?scenario=delayed&delay=500`
and measuring the response arrives no sooner than 500ms later; calling
`GET /api/v1/test?scenario=large-response` and confirming a response body materially larger than the
default; and calling `GET /api/v1/test?scenario=server-error&failureRate=0` (expect `200` every
time) versus `failureRate=1` (expect `500` every time).

**Acceptance Scenarios**:

1. **Given** `scenario=delayed` with a `delay` value in milliseconds not exceeding the configured
   maximum, **When** the client calls `GET /api/v1/test`, **Then** the system waits at least that
   long before returning `200`.
2. **Given** `scenario=delayed` with a `delay` value exceeding the configured maximum, **When** the
   client calls `GET /api/v1/test`, **Then** the system returns `400` with a `VALIDATION_ERROR` code
   rather than waiting the requested duration.
3. **Given** `scenario=large-response`, **When** the client calls `GET /api/v1/test`, **Then** the
   system returns `200` with a response body whose size is bounded by the configured maximum payload
   size, never allocating without bound.
4. **Given** a failure-representing scenario (`server-error`, `service-unavailable`, `rate-limit`, or
   `timeout`) combined with a `failureRate` strictly between `0` and `1`, **When** the client repeats
   the same call many times, **Then** the proportion of calls returning the failure outcome
   approximates the requested rate, and the remaining calls return `200`.
5. **Given** a failure-representing scenario with `failureRate=0`, **When** the client calls
   `GET /api/v1/test` any number of times, **Then** the system always returns `200`.
6. **Given** a failure-representing scenario with `failureRate=1` (or the parameter omitted, using
   the default of always failing for that scenario), **When** the client calls `GET /api/v1/test`,
   **Then** the system always returns the scenario's documented failure status.
7. **Given** an invalid `failureRate` (non-numeric, negative, or greater than `1`) or an invalid
   `delay` (non-numeric or negative), **When** the client calls `GET /api/v1/test`, **Then** the
   system returns `400` with a `VALIDATION_ERROR` code.

---

### Edge Cases

- What happens when `/errors/rate-limit` or `scenario=rate-limit` is called concurrently with real
  traffic against the actual `GET /rate-limit` endpoint from Spec 008? The two MUST remain fully
  independent — simulated rate-limit responses here never consume or reset the real rate-limit
  counters, and vice versa.
- What happens when a caller supplies valid, unexpired credentials (JWT or API key) to
  `/errors/unauthorized`, `/errors/forbidden`, or `scenario=unauthorized`/`forbidden`? The response
  MUST still be `401`/`403` — these are unconditional simulations, not real authorization checks,
  and MUST NOT be bypassable with valid credentials.
- What happens when `GET /errors/timeout` or `scenario=timeout` is called? The system MUST respond
  immediately with `408` rather than actually holding the connection open, so this endpoint stays
  lightweight and safe for load testing per the project's bounded-resource rule.
- What happens when `scenario=large-response` is combined with `delay`? Both behaviors MUST apply
  together (the response is delayed and then returned at the large size), each independently bounded
  by its own configured maximum.
- What happens when `failureRate` is supplied together with a non-failure scenario (`success`,
  `validation-error`, `unauthorized`, `forbidden`, `not-found`, `conflict`, `delayed`,
  `large-response`)? The system MUST ignore `failureRate` for these deterministic scenarios and
  return their fixed outcome every time, since probabilistic failure only applies to the scenarios
  listed in User Story 3.
- What happens when both `scenario` and `status` are supplied and they agree (e.g.
  `scenario=not-found&status=404`)? The system MUST accept the call and behave exactly as with
  `scenario` alone.
- What happens when `scenario` is omitted entirely and no `status` is supplied? The system MUST
  default to the `success` scenario and return `200`.

## Requirements *(mandatory)*

### Functional Requirements

**Dedicated error endpoints**

- **FR-001**: System MUST expose `GET /errors/validation`, `GET /errors/not-found`,
  `GET /errors/conflict`, `GET /errors/unauthorized`, `GET /errors/forbidden`,
  `GET /errors/rate-limit`, `GET /errors/server-error`, `GET /errors/service-unavailable`, and
  `GET /errors/timeout`, each deterministically returning one fixed status code and standard error
  envelope (`400`/`VALIDATION_ERROR`, `404`/`RESOURCE_NOT_FOUND`, `409`/`CONFLICT`,
  `401`/`UNAUTHORIZED`, `403`/`FORBIDDEN`, `429`/`RATE_LIMIT_EXCEEDED`, `500`/`INTERNAL_ERROR`,
  `503`/`SERVICE_UNAVAILABLE`, `408`/`REQUEST_TIMEOUT` respectively) regardless of any request
  headers, body, or credentials supplied.
- **FR-002**: System MUST return the `Retry-After` header on `GET /errors/rate-limit`, without
  reading from or writing to the real rate-limit counters used by `GET /rate-limit` (Spec 008).
- **FR-003**: System MUST respond to `GET /errors/timeout` immediately (no artificial hold), since
  it is a deterministic status-code simulation rather than an actual delayed response.

**Generic scenario endpoint**

- **FR-004**: System MUST expose `GET /api/v1/test`, accepting a `scenario` query parameter with
  values `success`, `validation-error`, `unauthorized`, `forbidden`, `not-found`, `conflict`,
  `rate-limit`, `server-error`, `service-unavailable`, `timeout`, `delayed`, and `large-response`,
  defaulting to `success` when omitted.
- **FR-005**: System MUST return the same status code and error code for each named failure
  scenario as the matching dedicated `/errors/*` endpoint from FR-001, so the two surfaces stay
  consistent.
- **FR-006**: System MUST reject an unrecognized `scenario` value with `400` and a
  `VALIDATION_ERROR` code that lists the supported scenario names.
- **FR-007**: System MUST accept an optional `status` query parameter matching any status code
  documented by the status-code playground (CLAUDE.md #6) — including body-less codes (`204`,
  `304`) and redirect codes (`301`, `302`) — and, when `scenario` is absent or `success`, return
  that exact status reusing Spec 004's exact per-code response construction (e.g. an empty body for
  `204`/`304`, a `Location` header for redirects).
- **FR-008**: System MUST reject a request where `status` is supplied alongside a `scenario` that
  has its own fixed status code (any value other than `success`, `delayed`, or `large-response`) and
  `status` differs from that scenario's fixed code, returning `400` with a `VALIDATION_ERROR` code
  rather than silently preferring either parameter. A `status` equal to the scenario's own fixed
  code MUST be accepted as redundant, and `status` MUST always be accepted alongside `success`,
  `delayed`, or `large-response`, none of which have a fixed status of their own to conflict with.
- **FR-009**: System MUST accept an optional `delay` query parameter (milliseconds) on
  `scenario=delayed`, waiting at least that long before responding, and MUST reject a `delay` that
  is negative, non-numeric, or exceeds the project's configured maximum delay with `400`.
- **FR-010**: System MUST, on `scenario=large-response`, return a response body matching the exact
  size of Spec 007's existing "large" payload preset (the same size `GET /payload/large` returns),
  bounded by the project's configured maximum payload size, never allocating without bound or
  introducing a second, independent definition of "large".
- **FR-011**: System MUST accept an optional `failureRate` query parameter (a decimal in `[0, 1]`)
  that applies only to the failure-representing scenarios (`server-error`, `service-unavailable`,
  `rate-limit`, `timeout`), probabilistically returning `200` instead of the scenario's failure
  outcome at approximately `1 - failureRate`, using the same seedable/reproducible random source
  established for `GET /flaky` in Spec 008.
- **FR-012**: System MUST reject an invalid `failureRate` (non-numeric, negative, or greater than
  `1`) with `400` and a `VALIDATION_ERROR` code.
- **FR-013**: System MUST ignore `failureRate` for scenarios that are not failure-representing
  (`success`, `validation-error`, `unauthorized`, `forbidden`, `not-found`, `conflict`, `delayed`,
  `large-response`), always returning their fixed, deterministic outcome regardless of any
  `failureRate` supplied — consistent with the Assumption that simulated auth failures are
  unconditional.

**Cross-cutting**

- **FR-014**: Every response produced by this feature, success or error, MUST include the
  `X-Request-ID` header; every error body MUST embed the same request id in the standard error
  envelope.
- **FR-015**: Every configurable maximum this feature relies on (maximum delay, maximum payload
  size) MUST be sourced from the project's existing environment configuration, never hardcoded or
  duplicated with a different limit.
- **FR-016**: None of this feature's endpoints MUST perform an external network call, and each MUST
  remain lightweight (no unbounded memory allocation, no expensive computation) except for the
  deliberate, bounded delay/payload-size behavior each scenario exists to demonstrate.
- **FR-017**: This feature's behavior MUST be fully documented in the OpenAPI specification once
  Spec 012 assembles it, including every scenario name, every optional query parameter, and every
  possible response status/error code.

### Key Entities

- **Error Scenario Endpoint**: One of the dedicated `/errors/*` routes; each maps to exactly one
  fixed HTTP status and error envelope code and takes no parameters.
- **Scenario Selector**: The `scenario` query parameter value on `GET /api/v1/test`; maps 1:1 onto
  the same status/error-code outcomes as the Error Scenario Endpoints, plus two additional
  behavior-only scenarios (`delayed`, `large-response`) that don't correspond to a dedicated
  `/errors/*` route.
- **Status Override**: The optional `status` query parameter on `GET /api/v1/test`, letting a caller
  reach any status code documented by the status-code playground (Spec 004) directly, without a
  named scenario — including body-less (`204`, `304`) and redirect (`301`, `302`) codes, each
  constructed exactly as Spec 004 already defines it.
- **Simulated Failure Rate** (reused from Spec 008's Flaky Outcome): an optional probability applied
  only to the failure-representing scenarios, determining whether a given call to
  `GET /api/v1/test` returns success or the scenario's normal failure outcome.
- **Simulated Delay** (reused from Spec 007): an optional, bounded wait applied before responding,
  used by the `delayed` scenario.
- **Large Response Payload** (reused from Spec 007): a bounded, oversized response body returned by
  the `large-response` scenario, sized identically to Spec 007's existing "large" payload preset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every one of the nine dedicated `/errors/*` endpoints returns its documented status and
  error code on 100% of calls, independent of any headers, credentials, or prior calls.
- **SC-002**: A single automated test script can exercise all twelve `GET /api/v1/test` scenarios by
  varying only the `scenario` query parameter, with each scenario's status/error code matching its
  dedicated `/errors/*` counterpart (where one exists) on 100% of calls.
- **SC-003**: A tester can reach any status code from the project's status-code playground through
  `GET /api/v1/test?status=...` without needing to know a scenario name, on 100% of documented codes.
- **SC-004**: A chaos-testing script can tune the observed failure proportion of a single scenario
  from 0% to 100% purely via the `failureRate` parameter, with the measured proportion over a large
  sample converging on the requested rate.
- **SC-005**: A performance-testing script can request a delayed and/or oversized response from one
  endpoint and observe both the added latency and the added payload size without exceeding the
  project's configured maximums, on 100% of calls.
- **SC-006**: None of this feature's endpoints introduce a measurable increase in per-request latency
  or memory usage during a load test beyond the bounded, intentional behavior each scenario exists to
  demonstrate.

## Assumptions

- **`/errors/*` are top-level, unauthenticated paths outside `/api/v1`**: mirroring Spec 007's and
  Spec 008's HTTP-testing/resilience utilities (`/delay`, `/payload`, `/rate-limit`, `/flaky`, etc.),
  since they are generic protocol-level testing utilities rather than domain resources.
- **`GET /api/v1/test` lives under `/api/v1`**: exactly as CLAUDE.md #26 specifies, distinguishing it
  from the top-level `/errors/*` utilities even though both surfaces overlap in outcomes.
- **Simulated auth failures are unconditional**: `/errors/unauthorized`, `/errors/forbidden`, and the
  matching `scenario` values never evaluate real credentials — they always return their fixed status,
  since their purpose is deterministic client-side error-handling verification, not access control.
- **Simulated rate-limit and timeout responses don't touch real state**: `/errors/rate-limit` and
  `scenario=rate-limit` never read or mutate the actual rate-limit counters from Spec 008, and
  `/errors/timeout`/`scenario=timeout` never actually hold the connection open — both stay
  instantaneous and side-effect-free, consistent with the constitution's bounded-resource rule for
  non-delay endpoints.
- **`failureRate` only applies to failure-representing scenarios**: `server-error`,
  `service-unavailable`, `rate-limit`, and `timeout` are the outcomes meaningful to make
  probabilistic (mirroring Spec 008's `/flaky`); `success`, `validation-error`, `not-found`,
  `conflict`, `delayed`, and `large-response` represent fixed request shapes or fixed behaviors and
  stay deterministic regardless of `failureRate`.
- **`status` is an escape hatch layered on top of `scenario`**, not a second independent dispatch
  mechanism: it is only consulted when no conflicting named scenario is given, letting a caller reach
  any status-code-playground value through this endpoint without this spec re-deriving a body shape
  for every one of the 24 documented codes from scratch — reusing the response construction already
  specified in Spec 004.
- **No new environment variables**: this feature reuses `MAX_DELAY_MS` and `MAX_PAYLOAD_SIZE`
  exactly as introduced in CLAUDE.md's existing `.env.example` and consumed by Spec 007; it
  introduces no configuration of its own. `failureRate`'s default when omitted is fixed at `1`
  (always fail), not sourced from the `FAILURE_RATE` env var — unlike `/flaky` (Spec 008), whose
  default favors success — so that a scenario called without `failureRate` matches its dedicated
  `/errors/*` counterpart's unconditional outcome exactly (FR-005).
- **This feature introduces no new mutable state**: because none of its endpoints touch the rate
  limiter, idempotency store, or any CRUD resource, it has nothing for Spec 011's admin-reset
  mechanism to reset.
