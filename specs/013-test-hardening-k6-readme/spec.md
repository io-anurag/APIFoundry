# Feature Specification: Automated Test Hardening, k6 Scenarios & README

**Feature Branch**: `013-test-hardening-k6-readme`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 013 — Automated Test Hardening, k6 Scenarios & README"

## Clarifications

### Session 2026-09-12

- Q: What concrete concurrency and duration profile should the k6 load/stress/spike/soak/concurrent-user scripts use by default? → A: Fixed lightweight defaults: smoke = 1 VU/30s; load = 20 VU steady for 2m; stress = ramp 20→100 VU over 5m; spike = sudden jump to 200 VU for 30s then drop; soak = 20 VU for 30m; concurrent-user = 50 VU each running the full chained workflow — all overridable via k6 CLI options/env vars.
- Q: What latency and error-rate thresholds should define a "passing" run for the k6 load/stress/spike scenarios? → A: Lightweight endpoints under load/stress/concurrent-user must keep p95 request duration under 500ms and HTTP error rate under 1%; delay/payload endpoints are excluded from the latency threshold since their expected latency equals the requested delay/size; the spike scenario allows a brief backlog during the jump but must return to <1% errors during ramp-down.
- Q: Should the spec require a minimum automated code-coverage percentage as an explicit completion gate, in addition to the feature-area checklist inventory already in SC-001? → A: Yes — add a concrete, enforced threshold (≥85% statement coverage via the test runner's coverage tool) as an objective gate alongside the manual checklist inventory.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trust the Whole Surface via One Automated Test Run (Priority: P1)

A contributor changes code anywhere in the server — a validation rule, an auth check, a response shape —
and needs a single command that proves every feature built across Specs 001-012 still behaves as
documented, without manually re-exercising each endpoint by hand.

**Why this priority**: This is the project's own quality gate ("The suite must pass before any
implementation work is considered done" per CLAUDE.md's Testing expectations) and the constitution's
requirement that new/changed endpoints carry automated coverage. Without it, every other spec's behavior
is only as trustworthy as the last manual check.

**Independent Test**: Can be fully tested by running the automated test command from a clean checkout and
confirming it exits successfully, with every resource, auth mechanism, status code, and edge-case
category listed in CLAUDE.md's feature surface represented by at least one passing test, and zero tests
skipped or flaky across repeated runs.

**Acceptance Scenarios**:

1. **Given** a clean checkout with dependencies installed, **When** the automated test command is run,
   **Then** it starts the server (or an in-process equivalent), executes the full suite, and exits with a
   success status when every test passes.
2. **Given** the full suite, **When** it is run twice in succession without any manual reset step in
   between, **Then** both runs produce identical pass/fail results — no test's outcome depends on leftover
   state from a previous run or on wall-clock time.
3. **Given** the feature checklist in CLAUDE.md (CRUD, all HTTP methods, path/query edge cases, validation,
   all three auth mechanisms including expiry/revocation/scopes/roles, pagination/filtering/sorting, status
   codes, delays, rate limiting, ETags, idempotency, nested resources, error handling), **When** the test
   suite is inventoried against that checklist, **Then** every item has at least one corresponding
   automated test, and any gap is treated as incomplete rather than assumed covered.
4. **Given** a deliberately introduced regression (e.g. a validation check removed, an auth guard skipped),
   **When** the suite is run, **Then** at least one existing test fails, demonstrating the suite actually
   detects the class of defect it claims to cover.

---

### User Story 2 - Exercise Realistic Load and Chained Workflows with k6 (Priority: P2)

A performance engineer wants to point k6 at the running mock server and immediately run representative
workloads — a single smoke check, a sustained load test, a spike, and a multi-step workflow that chains a
login through several dependent resource calls — without first writing scripts from scratch or guessing
which endpoints are safe to hammer.

**Why this priority**: CLAUDE.md's "k6 / workflow orientation" section explicitly names this as the
primary consumption pattern for automated/performance tooling and calls out a concrete chained example
(login → `/auth/me` → list users → get user → update user → create order → get order → delete user); it
is second priority because it depends on every endpoint from Specs 001-012 already existing and behaving
correctly, which User Story 1 verifies.

**Independent Test**: Can be fully tested by running each provided k6 script directly against a running
instance of the server and confirming it completes without script errors, its checks report expected pass
rates, and the chained-workflow script successfully carries a token and resource IDs from one request's
response into the next request's parameters.

**Acceptance Scenarios**:

1. **Given** a running server instance, **When** the smoke-test k6 script is run, **Then** it completes
   quickly with a minimal load level and all its checks pass, suitable as a fast sanity gate.
2. **Given** a running server instance, **When** the load/stress/spike/soak scenario scripts are run,
   **Then** each ramps virtual users according to its documented profile, targets endpoints safe for
   sustained load (per the constitution's bounded-resource-usage principle), and reports latency/error-rate
   metrics without the server crashing or the process needing a restart.
3. **Given** the chained-workflow script, **When** it executes, **Then** it logs in, extracts the returned
   token, calls `/auth/me` with it, lists users, fetches one user by an ID taken from that list, updates
   that user, creates an order, fetches the created order by its returned ID, and deletes a user — with
   every step's checks passing and each step's input drawn from the previous step's actual response.
4. **Given** the auth-focused, CRUD-focused, and error-rate-focused scenario categories named in CLAUDE.md,
   **When** each corresponding script is run, **Then** it targets the auth/CRUD/error-simulation endpoints
   relevant to its category and its own checks reflect expected outcomes for that category (e.g. the
   error-rate script expects a mix of error statuses, not all-success).
5. **Given** any k6 script that authenticates, **When** a token nears or passes its configured expiry
   during a long-running scenario, **Then** the script either refreshes it via `/auth/refresh` or clearly
   fails a check attributable to expiry, never silently misreporting an unrelated failure.

---

### User Story 3 - Get a New User or Tool From Zero to a Running, Understood Server (Priority: P3)

Someone who has never seen this repository — a new contributor, or an automated CI job — needs to go from
a fresh clone to a running server they understand well enough to hit any documented endpoint, using only
one document, without reading source code or asking a teammate.

**Why this priority**: CLAUDE.md's Testing expectations name a README as an explicit deliverable of this
spec, and the constitution's purpose principle depends on the server being discoverable; it is lowest
priority here because it documents behavior that Specs 001-012 and User Stories 1-2 must already have
built correctly — a README describing endpoints that don't work as written would be worse than none.

**Independent Test**: Can be fully tested by following only the README's own instructions on a clean
checkout — install, configure, run, then execute the curl examples it provides — and confirming every
step succeeds exactly as described, with no undocumented prerequisite step required.

**Acceptance Scenarios**:

1. **Given** a clean checkout and only the README open, **When** a reader follows its install/configure/run
   instructions, **Then** the server starts successfully with no step omitted from the document.
2. **Given** the README's endpoint catalog, **When** it is compared against `GET /api/v1/routes` and
   `GET /openapi.json` from the running server, **Then** every implemented endpoint category is represented
   in the README (grouped sensibly, not necessarily one line per route) and nothing the README describes is
   absent from the live server.
3. **Given** each curl example in the README, **When** it is copy-pasted and run verbatim against a freshly
   started, freshly seeded server, **Then** it produces the response shown or described, including examples
   covering at least one success case and one error case per major feature area (CRUD, auth, status codes,
   delays/payloads, rate limiting, admin reset).
4. **Given** the README's architecture section, **When** it is compared against the actual `src/` directory
   structure, **Then** the described module layout matches what exists on disk.

---

### Edge Cases

- What happens when a test in the suite depends on state left behind by another test (e.g. a created
  order, a revoked token, consumed rate-limit budget)? Tests MUST isolate their own state (via the admin
  reset endpoints from Spec 011, per-test setup, or independent fixtures) so suite order never affects
  outcomes.
- What happens when the suite hits the flaky/random or rate-limit endpoints (Spec 008)? Tests exercising
  them MUST pin reproducible parameters (fixed seed/`failureRate`, isolated rate-limit windows) rather than
  asserting on inherently variable behavior.
- What happens when a k6 load script is pointed at an endpoint that intentionally simulates delay, large
  payloads, or failures? The script's own checks MUST expect that endpoint's documented behavior (e.g.
  tolerate elevated latency on `/delay`, expect a failure-status mix on `/flaky`) rather than treating it
  as a defect.
- What happens when k6 scenario scripts are run against a server with default (non-production) rate-limit
  or delay configuration? Scripts MUST document the environment variables/config they assume so results
  are reproducible, and MUST fail loudly (not silently pass) if a prerequisite endpoint is unreachable.
- What happens when the README's examples reference IDs or tokens? Every example MUST either use a value
  obtainable from the server's deterministic seed data or explicitly show the step that generates it
  (e.g. login response), never a placeholder that can't actually be produced by following the doc.
- What happens if a future endpoint is added without corresponding test coverage or README mention? That
  state MUST be treated as incomplete per the constitution's quality gates — this spec's own completion
  criteria include verifying no such gap exists for everything implemented at the time it ships.

## Requirements *(mandatory)*

### Functional Requirements

**Automated test coverage**

- **FR-001**: System MUST provide a single command that installs dependencies, runs the full automated
  test suite (Jest or Vitest + Supertest, per the established stack), and reports a clear pass/fail result.
- **FR-002**: The test suite MUST include coverage for every feature area listed in CLAUDE.md's Testing
  expectations: CRUD across all resources, every HTTP method, path/query parameter edge cases, request
  validation, all three auth mechanisms (JWT including expiry/revocation, API key, Basic) plus roles and
  scopes, pagination/filtering/sorting, the full status-code playground, delays, rate limiting, ETag/
  caching behavior, idempotency, nested resources, and the error-simulation/generic-scenario endpoints.
- **FR-003**: The test suite MUST maintain at least 85% statement coverage (as measured by the test
  runner's coverage tool) as an objective, automated completion gate in addition to the feature-area
  checklist inventory in FR-002/SC-001.
- **FR-004**: Every test MUST be independently runnable in any order and MUST NOT depend on state left by
  another test; suites that need a clean starting state MUST reset it themselves (e.g. via the admin reset
  endpoints) rather than relying on the current process's history.
- **FR-005**: Tests covering endpoints with inherent variability (flaky/random, rate limiting) MUST pin
  reproducible parameters so results are deterministic across runs, consistent with the constitution's
  determinism principle.
- **FR-006**: Running the full suite twice in a row without manual intervention MUST produce identical
  results both times.

**k6 performance/workflow scenarios**

- **FR-007**: System MUST provide k6 scripts covering, at minimum, the following scenario categories named
  in CLAUDE.md: smoke, load, stress, spike, soak/endurance, latency, timeout, error-rate, auth-focused,
  CRUD-focused, chained-workflow, and concurrent-user. Each category MUST default to a fixed, documented
  concurrency/duration profile — smoke: 1 virtual user (VU) for 30s; load: 20 VUs steady for 2 minutes;
  stress: ramp 20→100 VUs over 5 minutes; spike: sudden jump to 200 VUs for 30s then drop; soak: 20 VUs
  for 30 minutes; concurrent-user: 50 VUs each independently running the full chained workflow — with
  every value overridable via k6 CLI options or environment variables for larger ad hoc runs.
- **FR-008**: System MUST provide at least one chained-workflow k6 script implementing the multi-step
  sequence named in CLAUDE.md (login → fetch own profile → list a resource → fetch one by ID drawn from
  that list → update it → create a dependent resource → fetch that created resource by its returned ID →
  delete a resource), passing each step's real response data into the next step's request.
- **FR-009**: Each k6 script MUST include checks that assert on expected outcomes for its scenario category
  (e.g. the error-rate script expects a documented mix of error statuses; the smoke script expects fast,
  all-success results) rather than only measuring latency. The load, stress, spike, and concurrent-user
  scripts MUST define explicit k6 thresholds requiring p95 request duration under 500ms and an HTTP error
  rate under 1% for lightweight endpoints, excluding delay/payload endpoints (whose expected latency
  equals the requested delay/size) from the latency threshold; the spike script MAY tolerate a brief
  backlog during the sudden jump but MUST return to under 1% errors by the end of its ramp-down.
- **FR-010**: k6 scripts targeting endpoints with configurable safety bounds (delay, payload size, rate
  limit, failure rate) MUST respect those bounds and MUST document any configuration they assume, so a
  reader can reproduce the same run.
- **FR-011**: k6 scripts MUST NOT target endpoints in a way that violates the constitution's bounded-
  resource-usage principle (no attempt to force unbounded memory allocation or external calls on
  endpoints not designed for that).

**README documentation**

- **FR-012**: System MUST provide a README covering: project overview and purpose, architecture/module
  layout, installation steps, configuration (environment variables and their meaning), how to run the
  server and the test suite, how to run the k6 scripts, and a full endpoint catalog grouped by feature
  area.
- **FR-013**: The README MUST include runnable curl examples covering at least one success case and one
  error/edge case per major feature area (CRUD, each auth mechanism, status-code playground, delays/
  payload endpoints, rate limiting, admin reset).
- **FR-014**: Every instruction, endpoint reference, and example in the README MUST match the actual
  running implementation exactly — no described endpoint, parameter, or behavior that the live server
  does not exhibit, and no implemented, documented (per Spec 012's OpenAPI/route-registry output) endpoint
  category left out of the README's catalog.

**Final quality gate**

- **FR-015**: Before this feature is considered complete, the following MUST all be verified in sequence
  against a clean environment: dependency install succeeds, the server starts with no errors, the full
  automated test suite passes (including the coverage gate in FR-003), and `/docs`, `/openapi.json`,
  `/openapi.yaml`, and `/api/v1/routes` are spot-checked against the actual running routes and found
  consistent.

### Key Entities

- **Automated Test Suite**: The full collection of Jest/Vitest + Supertest test files exercising every
  endpoint and edge case across Specs 001-012; the artifact that must pass before any implementation work
  is considered done.
- **k6 Scenario Script**: One executable performance/workflow script targeting the running server for a
  specific purpose (smoke, load, stress, spike, soak, latency, timeout, error-rate, auth, CRUD, chained-
  workflow, or concurrent-user), with its own checks and documented assumptions.
- **README**: The single onboarding document describing overview, architecture, setup, configuration,
  execution (server, tests, k6), and the full endpoint catalog with runnable examples.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the feature-area checklist in CLAUDE.md's Testing expectations has at least one
  corresponding automated test, verified by inventory rather than assumed, and the suite maintains at
  least 85% statement coverage as an additional, automated cross-check on that inventory.
- **SC-002**: The full automated test suite passes on a clean checkout, and passes again on an immediate
  repeat run with identical results, with zero flaky (order- or timing-dependent) tests.
- **SC-003**: Every k6 scenario category named in CLAUDE.md's k6/workflow orientation section has a
  runnable script that completes against a live server instance using its documented default
  concurrency/duration profile (smoke: 1 VU/30s; load: 20 VU/2m; stress: ramp 20→100 VU/5m; spike: jump to
  200 VU/30s; soak: 20 VU/30m; concurrent-user: 50 VU chained workflows), with its checks passing at the
  pass rate its category implies: near-100% for smoke/CRUD/auth scenarios; p95 request duration under
  500ms and HTTP error rate under 1% for load/stress/concurrent-user scenarios on lightweight endpoints
  (delay/payload endpoints excluded from the latency check); and a documented partial success rate for
  error-rate/flaky-adjacent scenarios.
- **SC-004**: A person following only the README, on a clean checkout, reaches a running, documented server
  in under 10 minutes without any undocumented step.
- **SC-005**: Every curl example in the README executes successfully against a freshly seeded server and
  produces the documented response.
- **SC-006**: The final quality-gate sequence (install → start → full suite green → spot-check of `/docs`,
  `/openapi.json`, `/openapi.yaml`, `/api/v1/routes`) completes with no discrepancy found.

## Assumptions

- **Scope is verification, hardening, and documentation of behavior already built by Specs 001-012**: this
  feature adds no new business endpoints; any test or README gap it uncovers is fixed as part of hardening
  existing behavior, not by inventing new scope.
- **k6 is the assumed load-testing tool**, per CLAUDE.md, run externally against a running server instance
  rather than in-process with the Jest/Vitest suite.
- **The test suite runs against either a real listening instance or an in-process app handle (e.g. via
  Supertest's app-object support)** — whichever the existing Spec 001 test harness already established —
  and this spec does not change that mechanism, only expands coverage.
- **No new environment variables or runtime configuration are introduced**; this feature consumes the
  configuration surface already defined by prior specs.
- **The README is a single top-level document** (`README.md`) rather than a multi-page docs site, matching
  the project structure already defined in CLAUDE.md.
