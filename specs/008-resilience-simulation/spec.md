# Feature Specification: Resilience Simulation

**Feature Branch**: `008-resilience-simulation`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 008 — Resilience Simulation"

## Clarifications

### Session 2026-09-12

- Q: How should the content of `/cache/resource` actually change during testing, so a client can
  exercise the "stale validator → 200 with new ETag" scenario? → A: Add a dedicated
  `PUT /cache/resource` endpoint that updates the resource's content and bumps its `ETag`/
  `Last-Modified` on demand, giving testers a deterministic, on-demand way to invalidate the cache.
- Q: Should an `Idempotency-Key` used with `POST /payments` ever expire on its own, or does it stay
  valid for the life of the server process? → A: No expiry — the key/result mapping persists for
  the process lifetime and is cleared only by the admin-reset mechanism, keeping behavior fully
  deterministic with no time-based element.
- Q: When `GET /flaky` decides to fail, does the caller pick which status code it fails with, or
  does the server pick randomly from the configured set (500/502/503/504)? → A: The server picks
  randomly (via the seeded, reproducible RNG) from the configured pool of failure statuses; the
  caller has no per-request control over which specific status is returned on failure.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger and Recover From Rate Limiting (Priority: P1)

A load-testing tool repeatedly calls a dedicated endpoint to confirm it can detect a `429` rate-limit
response, read the `Retry-After` hint, and verify the limit resets after the configured window.

**Why this priority**: Rate-limit handling is the most commonly automated resilience check
(CLAUDE.md #20) and every other scenario in this spec is independent of it, so it delivers value
standalone.

**Independent Test**: Can be fully tested by calling `GET /rate-limit` fewer than the configured
threshold times (expect `200` each time), then exceeding the threshold within the same window
(expect `429` with `Retry-After`), then waiting out the window and confirming requests succeed
again.

**Acceptance Scenarios**:

1. **Given** fewer requests than the configured threshold have been made within the current
   window, **When** the client calls `GET /rate-limit`, **Then** the system returns `200` with a
   body reporting the remaining quota.
2. **Given** the configured threshold has been reached within the current window, **When** the
   client calls `GET /rate-limit` again, **Then** the system returns `429` with a `Retry-After`
   header and the standard error envelope carrying a `RATE_LIMIT_EXCEEDED` code.
3. **Given** a client that has been rate-limited, **When** the configured window elapses and the
   client calls `GET /rate-limit` again, **Then** the system returns `200`, confirming the limit
   resets deterministically.
4. **Given** rate limiting is disabled via configuration, **When** the client calls
   `GET /rate-limit` any number of times, **Then** the system always returns `200`.

---

### User Story 2 - Simulate Flaky, Reproducible Failures (Priority: P2)

A tester requests an endpoint that fails a configurable percentage of the time with a configurable
failure status, to verify their client's retry, backoff, and circuit-breaker logic — while being
able to reproduce a specific pass/fail sequence for an automated test assertion.

**Why this priority**: Flaky-dependency simulation is the second resilience behavior CLAUDE.md
calls out (#21) and is independent of rate limiting, idempotency, and caching.

**Independent Test**: Can be fully tested by calling `GET /flaky?failureRate=1` (expect a failure
status every time), `GET /flaky?failureRate=0` (expect `200` every time), and confirming a fixed
seed/request-sequence combination reproduces the same pass/fail pattern across repeated full test
runs.

**Acceptance Scenarios**:

1. **Given** `failureRate=0` (or the parameter omitted, using the configured default), **When**
   the client calls `GET /flaky`, **Then** the system always returns `200`.
2. **Given** `failureRate=1`, **When** the client calls `GET /flaky`, **Then** the system always
   returns one of the configured failure statuses (`500`, `502`, `503`, `504`).
3. **Given** a `failureRate` strictly between `0` and `1` and a fixed random seed, **When** the
   client repeats the same sequence of calls across two separate full test runs, **Then** both
   runs produce an identical sequence of pass/fail outcomes.
4. **Given** an invalid `failureRate` (non-numeric, negative, or greater than `1`), **When** the
   client calls `GET /flaky`, **Then** the system returns `400` with the standard error envelope
   rather than an arbitrary or crashing behavior.
5. **Given** flaky simulation is disabled via configuration, **When** the client calls
   `GET /flaky` with any `failureRate`, **Then** the system always returns `200`.

---

### User Story 3 - Submit Idempotent Payments (Priority: P3)

A payment-processing client submits a payment request with an idempotency key, retries the exact
same request after a network timeout, and confirms it receives the original result rather than a
duplicate charge — then attempts to reuse the same key with different request contents and
confirms the system rejects the conflicting reuse.

**Why this priority**: Idempotent write behavior (CLAUDE.md #22) is the resilience pattern most
directly tied to financial-style correctness and depends on the read-oriented `payments` resource
already introduced in Spec 003, but not on rate limiting, flakiness, or caching.

**Independent Test**: Can be fully tested by calling `POST /payments` with a fresh
`Idempotency-Key` and body (expect `201` and a new payment), repeating the identical call with the
same key and body (expect `200` with the same payment, not a second one created), then repeating
with the same key but a different body (expect `409`).

**Acceptance Scenarios**:

1. **Given** a `POST /payments` request with a new `Idempotency-Key` header and a valid body,
   **When** the client calls it, **Then** the system creates one new payment and returns `201`
   with that payment's representation.
2. **Given** the exact same `Idempotency-Key` and request body as a prior successful call, **When**
   the client repeats `POST /payments`, **Then** the system returns `200` with the original
   payment's representation, without creating a second payment.
3. **Given** the same `Idempotency-Key` as a prior call but a different request body, **When** the
   client calls `POST /payments`, **Then** the system returns `409` with the standard error
   envelope and an `IDEMPOTENCY_KEY_CONFLICT` code, without creating or modifying any payment.
4. **Given** a `POST /payments` request missing the `Idempotency-Key` header, **When** the client
   calls it, **Then** the system returns `400` with the standard error envelope.
5. **Given** a `POST /payments` request with a valid `Idempotency-Key` but an invalid body (missing
   required fields, wrong types), **When** the client calls it, **Then** the system returns `400`
   or `422` and does **not** reserve the idempotency key for a later, differently-shaped retry.

---

### User Story 4 - Validate Cached Responses (Priority: P4)

A caching-aware HTTP client requests a resource, stores the returned `ETag`/`Last-Modified`, then
re-requests it with `If-None-Match`/`If-Modified-Since` to confirm the server correctly reports
"not modified" without re-sending the full body, and confirms a changed resource invalidates the
cache.

**Why this priority**: Caching/conditional-request support (CLAUDE.md #23) is the last resilience
behavior in this spec and is independent of rate limiting, flakiness, and idempotency.

**Independent Test**: Can be fully tested by calling `GET /cache/resource` once (capturing `ETag`
and `Last-Modified`), calling it again with `If-None-Match` set to that `ETag` (expect `304`), then
calling `PUT /cache/resource` to change its content and calling `GET /cache/resource` again with
the now-stale conditional header (expect `200` with a new `ETag`).

**Acceptance Scenarios**:

1. **Given** no conditional headers, **When** the client calls `GET /cache/resource`, **Then** the
   system returns `200` with `ETag`, `Last-Modified`, and `Cache-Control` headers and the full
   response body.
2. **Given** an `If-None-Match` header equal to the resource's current `ETag`, **When** the client
   calls `GET /cache/resource`, **Then** the system returns `304` with no response body.
3. **Given** an `If-Modified-Since` header equal to or later than the resource's current
   `Last-Modified`, **When** the client calls `GET /cache/resource`, **Then** the system returns
   `304` with no response body.
4. **Given** an `If-None-Match` header that does **not** match the resource's current `ETag`,
   **When** the client calls `GET /cache/resource`, **Then** the system returns `200` with the full
   body and current validators.
5. **Given** the underlying resource has been changed via `PUT /cache/resource`, **When** the
   client calls `GET /cache/resource` with a previously-valid `If-None-Match`, **Then** the system
   returns `200` with a new `ETag` reflecting the change, not `304`.
6. **Given** a `PUT /cache/resource` request with a valid body, **When** the client calls it,
   **Then** the system returns `200` with the updated resource and its newly-issued `ETag` and
   `Last-Modified` headers.

---

### Edge Cases

- What happens when `GET /rate-limit` is called concurrently by many clients (distinguished by
  `X-API-Key`, an authenticated identity, or IP) right at the threshold boundary? Each caller's
  quota MUST be tracked independently so one caller cannot exhaust another's limit.
- What happens when the rate-limit window rolls over mid-burst? Requests made in the new window
  MUST count against the new window's quota only, never carrying over partial counts.
- What happens when `GET /flaky?failureRate=` is passed a value like `0.5000001` or scientific
  notation? The system MUST validate it strictly as a decimal in `[0, 1]` and return `400`
  otherwise, never coercing or crashing.
- What happens when two concurrent `POST /payments` requests use the same new `Idempotency-Key`
  at the same time (a race)? The system MUST ensure only one payment is ever created for that key,
  with the losing request either receiving the winner's result or a `409`, never a duplicate.
- What happens when an `Idempotency-Key` is reused long after its original request? The system
  MUST still honor it deterministically (same key + same body → same stored result) since
  idempotency records never expire on their own within a running process.
- What happens when `GET /cache/resource` receives both `If-None-Match` and `If-Modified-Since`
  with conflicting outcomes (one matches, one doesn't)? `If-None-Match` MUST take precedence, per
  standard HTTP caching semantics.
- What happens when a malformed `If-None-Match` or `If-Modified-Since` header is sent? The system
  MUST treat it as not matching (return `200` with the full body) rather than erroring.

## Requirements *(mandatory)*

### Functional Requirements

**Rate limiting**

- **FR-001**: System MUST expose `GET /rate-limit`, tracking a per-caller request count against a
  configurable threshold and window, returning `200` with the remaining quota while under the
  threshold.
- **FR-002**: System MUST return `429` with a `Retry-After` header and the standard error envelope
  (`RATE_LIMIT_EXCEEDED`) once a caller exceeds the threshold within the current window.
- **FR-003**: System MUST reset a caller's quota once its configured window elapses, deterministically
  and without requiring a server restart.
- **FR-004**: System MUST allow rate limiting to be disabled entirely via configuration, in which
  case `GET /rate-limit` always returns `200`.

**Flaky/random failures**

- **FR-005**: System MUST expose `GET /flaky?failureRate=`, returning `200` on success and, on
  simulated failure, a status randomly selected by the server (not caller-specified) from a
  configurable pool of failure statuses (`500`, `502`, `503`, `504`), at approximately the
  requested rate.
- **FR-006**: System MUST default `failureRate` to a configured value when the parameter is omitted,
  and MUST reject a `failureRate` outside `[0, 1]` or non-numeric with `400`.
- **FR-007**: System MUST make failure/success selection reproducible for automated tests (e.g. via a
  seedable RNG), so a fixed seed and call sequence yields an identical outcome sequence on repeated
  runs.
- **FR-008**: System MUST allow flaky simulation to be disabled entirely via configuration, in which
  case `GET /flaky` always returns `200` regardless of `failureRate`.

**Idempotent payments**

- **FR-009**: System MUST expose `POST /payments`, requiring an `Idempotency-Key` header, and reject
  requests missing it with `400`.
- **FR-010**: System MUST validate the request body per the existing Payment model's required
  fields/types, returning `400`/`422` for invalid bodies without consuming or reserving the supplied
  idempotency key for that invalid shape.
- **FR-011**: System MUST, for a new `Idempotency-Key`, create exactly one new payment and return
  `201` with its representation.
- **FR-012**: System MUST, for a previously-used `Idempotency-Key` reused with an identical request
  body, return `200` with the original stored result rather than creating a new payment.
- **FR-013**: System MUST, for a previously-used `Idempotency-Key` reused with a different request
  body, return `409` with the standard error envelope (`IDEMPOTENCY_KEY_CONFLICT`) and MUST NOT
  create or modify any payment.
- **FR-014**: System MUST ensure concurrent requests bearing the same new `Idempotency-Key` never
  result in more than one payment being created for that key.

**Caching**

- **FR-015**: System MUST expose `GET /cache/resource`, returning `200` with `ETag`, `Last-Modified`,
  and `Cache-Control` headers alongside the full response body when no conditional headers are
  present or they don't match.
- **FR-016**: System MUST return `304` with no response body when the request's `If-None-Match`
  matches the resource's current `ETag`, giving `If-None-Match` precedence over `If-Modified-Since`
  when both are present and disagree.
- **FR-017**: System MUST return `304` with no response body when `If-None-Match` is absent and the
  request's `If-Modified-Since` is at or after the resource's current `Last-Modified`.
- **FR-018**: System MUST expose `PUT /cache/resource`, updating the resource's content and
  reissuing its `ETag` and `Last-Modified` so any previously-valid conditional header for that
  resource correctly falls back to `200` with a full body on the next `GET`.

**Cross-cutting**

- **FR-019**: Every response produced by this feature, success or error, MUST include the
  `X-Request-ID` header; every error body MUST embed the same request id in the standard error
  envelope.
- **FR-020**: Every configurable threshold, window, rate, or flag introduced by this feature (rate
  limit count/window, failure rate default, `FLAKY_ENABLED`) MUST be sourced from environment
  configuration, never hardcoded.
- **FR-021**: None of this feature's endpoints MUST perform an external network call, and each MUST
  remain lightweight (no unbounded memory allocation, no expensive computation) except for the
  deliberate, bounded failure/latency behavior each endpoint exists to demonstrate.
- **FR-022**: All state this feature introduces (rate-limit counters, idempotency records) MUST be
  resettable to its initial seed state by the project's existing admin-reset mechanism once that
  mechanism exists.

### Key Entities

- **Rate Limit Counter**: A per-caller (by API key, authenticated identity, or IP) count of requests
  within the current configured window; resets automatically when the window elapses.
- **Flaky Outcome**: A single pass/fail decision produced for one `GET /flaky` call, derived from the
  requested `failureRate` and a seedable random source; when it fails, the specific status is chosen
  by the server at random from the configured pool of failure statuses, never by the caller.
- **Idempotency Record**: A stored association between an `Idempotency-Key`, a hash/representation of
  the original request body, and the resulting payment plus response status — used to detect exact
  replays versus conflicting reuses of the same key. Has no time-based expiry; it persists for the
  life of the server process and is cleared only by the project's admin-reset mechanism.
- **Payment** (reused from Spec 003): A transaction record with a UUID identifier and a `status` of
  `pending`, `completed`, `failed`, or `refunded`; this feature adds the write path that creates new
  Payment records.
- **Cacheable Resource**: A single demo resource exposed at `/cache/resource` whose current
  representation determines its `ETag` and `Last-Modified` validators; updated only via
  `PUT /cache/resource`, which reissues both validators and invalidates any previously issued ones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A caller can reliably reach the configured rate-limit threshold, receive `429` with a
  usable `Retry-After` value on every request past it, and succeed again after the window elapses,
  with 100% consistency across repeated test runs.
- **SC-002**: A fixed `failureRate` and random seed produce the identical pass/fail sequence across
  independent test runs 100% of the time, while `failureRate=0` and `failureRate=1` are deterministic
  in the single-outcome case (never a false success/failure).
- **SC-003**: 100% of `POST /payments` retries using the same `Idempotency-Key` and body return the
  original result rather than creating a duplicate payment, and 100% of same-key-different-body
  reuses are rejected with `409`.
- **SC-004**: A client can complete a fetch → conditional-refetch → resource-change → conditional-refetch
  cycle against `/cache/resource` in four requests, receiving `304` exactly when the resource is
  unchanged and `200` with new validators exactly when it has changed, with 100% consistency across
  repeated runs.
- **SC-005**: None of this feature's endpoints introduce a measurable increase in per-request latency
  or memory usage during a load test, beyond the bounded, intentional behavior each endpoint exists to
  demonstrate.

## Assumptions

- **Per-caller identity for rate limiting**: in the absence of authentication on `GET /rate-limit`
  itself, the caller is distinguished by `X-API-Key` when present, otherwise by client IP —
  consistent with how rate limiting is commonly scoped, and configurable enough to swap later
  without changing this spec's observable behavior.
- **`GET /rate-limit` and `GET /flaky` are top-level, unauthenticated paths**: mirroring Spec 007's
  HTTP testing utilities (`/delay`, `/payload`, etc.), which also sit outside `/api/v1` and require
  no auth, since they are generic protocol-level testing utilities rather than domain resources.
- **`POST /payments` lives under `/api/v1`**: because it operates on the `payments` domain resource
  introduced in Spec 003 (`/api/v1/payments/...`), unlike the protocol-level utilities above.
- **`/cache/resource` is a single, dedicated demo resource**: not a wrapper around an existing CRUD
  resource, keeping caching semantics isolated and independently testable; it is mutated only via
  its own `PUT /cache/resource` (confirmed in Clarifications above), not through unrelated
  resources' CRUD endpoints.
- **Idempotency records and rate-limit counters persist only in memory** for the life of the process,
  consistent with the project's in-memory-storage architecture, with no time-based expiry (confirmed
  in Clarifications above); they are reset by the admin-reset endpoint once Spec 011 introduces it
  (tracked as FR-022, not implemented by this spec).
- **One new environment variable, `FLAKY_ENABLED`**: `RATE_LIMIT_ENABLED`, `RATE_LIMIT_REQUESTS`,
  `RATE_LIMIT_WINDOW_MS`, and `FAILURE_RATE` are reused as-is from CLAUDE.md's existing list. CLAUDE.md
  also requires `/flaky` to be "disableable" (item #21) independent of whatever `failureRate` a caller
  supplies (FR-008) — `FAILURE_RATE` alone (a default probability a caller can override) cannot express
  that, so this spec adds `FLAKY_ENABLED` (boolean, default `true`), mirroring the existing
  `RATE_LIMIT_ENABLED` switch already in `.env.example` for the same kind of feature-level on/off
  control. Idempotency and caching introduce no new required configuration beyond reasonable,
  documented defaults.
