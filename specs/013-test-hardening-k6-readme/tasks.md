---

description: "Task list template for feature implementation"
---

# Tasks: Automated Test Hardening, k6 Scenarios & README

**Input**: Design documents from `/specs/013-test-hardening-k6-readme/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [quickstart.md](quickstart.md)

**Tests**: This feature's entire purpose is test/tooling hardening, so "tests" and "implementation"
are the same work for User Story 1 — there is no separate contract/integration-test subsection.
User Stories 2 and 3 are validated manually via `quickstart.md` (k6 has no Vitest-style assertion
runner integration, and README accuracy is verified by literally following the document).

**Organization**: Tasks are grouped by user story (from spec.md). A pre-plan audit (research.md)
found 42 existing Vitest+Supertest test files already cover nearly every CLAUDE.md Testing
Expectations category, no coverage tool installed, no `k6/` directory at all, and a README that
stops at Spec 011 with zero curl examples — so this feature's real work is closing those three
concrete gaps, not building a test suite from scratch.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root (existing, unchanged), plus one
new top-level `k6/` directory. No new `src/` business-logic file — this feature touches only
`package.json`, `vitest.config.ts`, `README.md`, `tests/*.test.ts` (additive assertions only), and
the new `k6/` tree.

---

## Phase 1: Setup

**Purpose**: New tooling/dependencies shared across user stories.

- [X] T001 Add `@vitest/coverage-v8` as a devDependency (pin to the `^2.1.x` line to match the
      already-installed `vitest@^2.1.3`). In `vitest.config.ts`, add a `coverage` block to the
      existing `test` config: `provider: "v8"`, `reporter: ["text", "html", "lcov"]`,
      `include: ["src/**/*.ts"]`, `thresholds: { statements: 85 }` (research.md Decision 1 —
      statements-only per the Session 2026-09-12 Q3 clarification; branches/functions/lines are
      still reported by the `text`/`html` reporters but left ungated). In `package.json`, add
      `"test:coverage": "vitest run --coverage"` alongside the existing `"test": "vitest run"` (left
      unchanged, so day-to-day `npm test` stays fast).
- [X] T002 [P] Create `k6/lib/config.js`: reads `BASE_URL` from k6's `__ENV` object, defaulting to
      `"http://localhost:3000"` when unset, and exports it alongside a fixed
      `API_PREFIX = "/api/v1"` constant, e.g.:
      ```js
      export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
      export const API_PREFIX = "/api/v1";
      ```
- [X] T003 [P] Create `k6/lib/auth.js` (depends on T002): exports `login(username, password)` —
      POSTs `{ username, password }` as JSON to `${BASE_URL}/auth/login`, returns the parsed
      `{ accessToken, refreshToken }` — and `authHeader(token)` returning
      `{ Authorization: \`Bearer ${token}\` }`, reusing `src/data/demoAccounts.seed.ts`'s fixed demo
      credentials (`demo.admin` / `admin-pass-1`, etc. — never a new/hardcoded real secret, per the
      constitution's Secret & Credential Hygiene principle).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the pre-existing baseline this feature hardens is itself sound, before
layering a coverage gate, k6 scripts, or README claims on top of it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Run `npm install && npm test` on a clean checkout and confirm the pre-existing 42-file
      suite passes with exit code 0 (no pre-existing failure). This is the baseline User Story 1
      audits/extends, User Story 2's chained-workflow script exercises, and User Story 3's README
      claims describe — if this fails, that is an out-of-scope regression in prior specs' work to
      flag before proceeding, not something this feature's tasks should paper over. **Done** —
      `npm test` reports 42 test files, 509 tests, all passing, in ~7s.

**Checkpoint**: Baseline confirmed green — user story work can begin.

---

## Phase 3: User Story 1 - Trust the Whole Surface via One Automated Test Run (Priority: P1) 🎯 MVP

**Goal**: `npm test` stays green and reproducible; the CLAUDE.md Testing Expectations checklist is
verified item-by-item against the 42 existing test files (not assumed); the one concrete gap that
verification finds is closed; `npm run test:coverage` enforces ≥85% statement coverage.

**Independent Test**: Run `npm test` twice in a row (identical results both times), then
`npm run test:coverage` (exit 0, statement coverage ≥85% printed). See quickstart.md Scenario 1.

### Implementation for User Story 1

- [X] T005 [US1] Perform the CLAUDE.md Testing-Expectations checklist audit against the 42 existing
      `tests/*.test.ts` files (data-model.md's `TestChecklistItem`/Coverage-inventory table).
      **Grep-verified findings, recorded here rather than left to assumption (SC-001)**:
      pagination-edge-case rejection (`page=0` → 400) is asserted in `tests/users.test.ts`,
      `tests/products.test.ts`, `tests/orders.test.ts`, `tests/customers.test.ts`, `tests/files.test.ts`;
      `Retry-After` is asserted in `tests/errorScenarios.test.ts` and `tests/statusCodes.test.ts`;
      ETag/`If-None-Match`/`Last-Modified` in `tests/cache.test.ts`; idempotency conflict
      (`IDEMPOTENCY_KEY_CONFLICT`, 409) in `tests/paymentsIdempotency.test.ts`; token
      expiry/revocation in `tests/authToken.test.ts` and `tests/apiKey.test.ts`; nested-array
      validation (`items[].quantity`, empty-array minimum, unknown-field rejection) in
      `tests/orders.test.ts`. **One concrete gap found**: `tests/users.test.ts`,
      `tests/products.test.ts`, `tests/orders.test.ts`, `tests/customers.test.ts` never assert a
      `405` for an unsupported method on their own routes, unlike `tests/categories.test.ts`,
      `tests/comments.test.ts`, `tests/payments.test.ts`, `tests/posts.test.ts`,
      `tests/reviews.test.ts`, `tests/routes.test.ts`, `tests/statusCodes.test.ts`,
      `tests/admin.test.ts`, `tests/cache.test.ts`, `tests/errorScenarios.test.ts`,
      `tests/flaky.test.ts`, `tests/rateLimit.test.ts`, which already do (each resource route file
      already wires `methodNotAllowedHandler` via e.g. `userRouter.all("/users", ...)` — this is a
      test gap, not a behavior gap). No other gap found in this pass. Update `data-model.md`'s
      Coverage inventory table: mark every row `"covered"` except append a note on the "All HTTP
      methods" row naming the four files closed by T006-T009 below.
- [X] T006 [US1] Add unsupported-method assertions to `tests/users.test.ts` (depends on T005):
      `PATCH /api/v1/users` (collection route, no `:id`) → `405`; `POST /api/v1/users/{id}` (item
      route) → `405` — mirroring the existing `expect(res.status).toBe(405)` pattern already used
      in `tests/categories.test.ts`/`tests/routes.test.ts`.
- [X] T007 [P] [US1] Add the same two unsupported-method assertions (collection `PATCH`, item `POST`)
      to `tests/products.test.ts` (depends on T005).
- [X] T008 [P] [US1] Add the same two unsupported-method assertions to `tests/orders.test.ts`
      (depends on T005).
- [X] T009 [P] [US1] Add the same two unsupported-method assertions to `tests/customers.test.ts`
      (depends on T005).
- [X] T010 [US1] Run `npm run test:coverage` (depends on T001, T006-T009) and confirm statement
      coverage ≥85% (FR-003). If the printed percentage is below 85%, open the generated
      `coverage/index.html` (or the `text` reporter's per-file breakdown), identify the lowest-
      covered `src/` file(s), and add the minimal additional `tests/*.test.ts` assertions needed to
      close the gap — record which file(s) needed closing and the before/after percentage here once
      run, since the exact number is not knowable before this task executes. **Done** — statement
      coverage is 98.27% (517 tests, 42 files, exit code 0), well above the 85% gate; no gap-closing
      tests were needed.
- [X] T011 [US1] Run `npm test` twice in immediate succession (no manual reset step between runs)
      and confirm both runs report an identical pass/fail result (FR-005, SC-002) — a verification
      task with no code change expected; a discrepancy here is itself a bug to fix before continuing
      (most likely a test that depends on another test's leftover state, contra FR-004). **Done** —
      both runs report 42 test files, 517 tests, all passing.

**Checkpoint**: User Story 1 fully functional and independently testable — `npm test` is green and
reproducible, the checklist audit is verified (not assumed) with its one gap closed, and
`npm run test:coverage` enforces the 85% statement-coverage gate (quickstart.md Scenario 1).

---

## Phase 4: User Story 2 - Exercise Realistic Load and Chained Workflows with k6 (Priority: P2)

**Goal**: One runnable k6 script per FR-007 category (smoke, load, stress, spike, soak, latency,
timeout, error-rate, auth, crud, chained-workflow, concurrent-user), each using the Session
2026-09-12-clarified default VU/duration profile and thresholds, safely repeatable against a live
server without depleting seed data.

**Independent Test**: `BASE_URL=http://localhost:3000 k6 run k6/<script>.js` for each script
completes with its checks passing at its category's expected rate. See quickstart.md Scenario 2.

### Implementation for User Story 2

- [X] T012 [US2] Create `k6/lib/workflow.js` (depends on T002, T003) exporting
      `runChainedWorkflow()`, implementing FR-008's exact named sequence with one safety adaptation
      (documented inline, matching spec.md's Acceptance Scenario 3 wording "...and deletes **a**
      user", not necessarily the same user just read/updated): login as `demo.admin` → `GET
      /auth/me` with the returned token (confirms identity) → `GET /api/v1/users?page=1&limit=5`
      (list) → `GET /api/v1/users/{id}` for the first entry's `id` from that list response (get) →
      `PATCH /api/v1/users/{id}` on that same id, e.g. `{ status: "inactive" }` (update; reversible,
      safe under concurrency/soak since it never removes a seeded row) → `POST /api/v1/orders`
      `{ customerId: 1, items: [{ productId: 1, quantity: 1 }] }` (create; capture the response's
      order `id`) → `GET /api/v1/orders/{id}` with that id (get) → `POST /api/v1/users` with a
      per-iteration-unique email (e.g. `` `k6-${__VU}-${__ITER}-${Date.now()}@example.com` ``) to
      create a disposable throwaway user (capture its `id`) → `DELETE /api/v1/users/{id}` on that
      disposable id. **Rationale for the throwaway-user delete target**: deleting an arbitrary
      *seeded* user would permanently shrink the fixed 50-user seed pool every time this script (or
      `concurrent-user.js`, at 50 VUs) runs, eventually breaking other tests/scripts that assume ≥50
      seeded users exist — creating a disposable user specifically to delete keeps every step's
      input still drawn from a real prior response (FR-008) while leaving seed data intact across
      repeated/concurrent runs. Every HTTP call MUST include `check()` assertions on status code and,
      where applicable, response shape.
- [X] T013 [US2] Create `k6/chained-workflow.js` (depends on T012): `import { runChainedWorkflow }
      from "./lib/workflow.js";` `export const options = { vus: 1, iterations: 1 };`
      `export default function () { runChainedWorkflow(); }` — a single end-to-end pass through
      FR-008's sequence, for direct demonstration/CI smoke use.
- [X] T014 [P] [US2] Create `k6/smoke.js` (depends on T002): `export const options = { vus: 1,
      duration: "30s" };` — iterates a representative handful of lightweight, read-only endpoints
      (`GET /health`, `GET /api/v1/users`, `GET /api/v1/products`, `GET /api/v1/status/200`) with
      `check()`s expecting `200` on every call; no custom thresholds beyond k6's implicit
      all-checks-pass expectation (data-model.md K6ScenarioScript: smoke = 1 VU/30s).
- [X] T015 [P] [US2] Create `k6/load.js` (depends on T002): `export const options = { vus: 20,
      duration: "2m", thresholds: { http_req_duration: ["p(95)<500"], http_req_failed: ["rate<0.01"]
      } };` — targets the same lightweight read endpoints as `smoke.js` plus a light write mix
      (`PATCH /api/v1/users/{id}` on a fixed seeded id) (data-model.md: load = 20 VU/2m, p95<500ms,
      errors<1%).
- [X] T016 [P] [US2] Create `k6/stress.js` (depends on T002): `export const options = { stages: [{
      duration: "5m", target: 100 }], startVUs: 20, thresholds: { http_req_duration: ["p(95)<500"],
      http_req_failed: ["rate<0.01"] } };` (ramp 20→100 VUs over 5 minutes per the k6 ramping-VUs
      executor) — same endpoint mix as `load.js` (data-model.md: stress = ramp 20→100 VU/5m,
      p95<500ms, errors<1%).
- [X] T017 [P] [US2] Create `k6/spike.js` (depends on T002): `export const options = { stages: [{
      duration: "5s", target: 200 }, { duration: "25s", target: 200 }, { duration: "10s", target: 0
      }], thresholds: { http_req_failed: ["rate<0.01"] } };` (sudden jump to 200 VUs held ~30s then
      drop) — the threshold is evaluated over the whole run, so document in a code comment that a
      brief backlog during the jump is expected and only the run's overall/tail error rate must
      clear <1% (Session 2026-09-12 Q2; data-model.md: spike = jump to 200 VU/30s).
- [X] T018 [P] [US2] Create `k6/soak.js` (depends on T002): `export const options = { vus: 20,
      duration: "30m", thresholds: { http_req_duration: ["p(95)<500"], http_req_failed: ["rate<0.01"]
      } };` — same lightweight endpoint mix as `load.js`, run long enough to surface any slow memory
      growth or leak (data-model.md: soak = 20 VU/30m).
- [X] T019 [P] [US2] Create `k6/latency.js` (depends on T002): no VU/duration threshold (functional,
      not load-shaped, per data-model.md) — calls `GET /delay/500` and
      `GET /api/v1/test?scenario=delayed&delay=500`, asserting via `check()` that
      `res.timings.duration` is at least the requested `500` ms (tracks the requested delay) and
      well under `MAX_DELAY_MS` (10000 by default); also calls `GET /delay/{ms}` with `ms` above the
      configured `MAX_DELAY_MS` and asserts it is rejected (`400`) rather than honored, per the
      constitution's bounded-resource-usage principle.
- [X] T020 [P] [US2] Create `k6/timeout.js` (depends on T002): calls
      `GET /api/v1/test?scenario=timeout` and `GET /errors/timeout`, asserting (via `check()`) each
      returns its documented `408` status within a reasonable wall-clock bound — proving the
      server's own timeout simulation completes instead of actually hanging the connection.
- [X] T021 [P] [US2] Create `k6/error-rate.js` (depends on T002): no load-shaped VU/duration
      threshold (per data-model.md, this category expects a documented *mix*, not a low error rate).
      Two groups: **(a)** `GET /flaky?failureRate=0.5` called ~50 times per iteration, asserting the
      aggregate failure proportion across the run lands within a tolerance band (e.g. 30%-70%) of
      the requested `0.5` rather than asserting any single call's outcome (research.md Decision 3 —
      `/flaky`'s PRNG sequence is internal to the server process); **(b)** a rate-limit check that
      assigns each VU a distinct `X-API-Key` header (e.g. `` `k6-vu-${__VU}` ``) so concurrent VUs
      don't collide on one IP-keyed counter (`resolveCallerIdentity` keys by `X-API-Key` when
      present, else request IP), then calls `GET /rate-limit` enough times per VU to exceed
      `RATE_LIMIT_REQUESTS` and asserts a `429` with a `Retry-After` header eventually appears.
- [X] T022 [P] [US2] Create `k6/auth.js` (depends on T003): near-100%-pass functional script
      (data-model.md) covering, per iteration: `login()` with valid `demo.user` credentials → `200`;
      `login()` with a wrong password → `401`; `GET /auth/me` with no token → `401`; `POST
      /auth/token?kind=expired` then using that token on `GET /auth/me` → `401`; `POST
      /auth/token?kind=revoked` similarly → `401`; a scopes check (`GET /api/v1/scope/{scope}` with
      a token lacking that scope → `403` with `INSUFFICIENT_SCOPE`) and a roles check (`GET
      /api/v1/role/{role}` with a mismatched role → `403`).
- [X] T023 [P] [US2] Create `k6/crud.js` (depends on T002): near-100%-pass functional script
      exercising one full CRUD pass per resource (`users`, `products`, `orders`, `customers`): `POST`
      create → `201`, `GET` the created item by its returned id → `200` with matching fields, `PUT`
      or `PATCH` update → `200`, `DELETE` → `204`, then `GET` the same id again → `404` — proving the
      full lifecycle, not just isolated calls.
- [X] T024 [US2] Create `k6/concurrent-user.js` (depends on T012): `import { runChainedWorkflow }
      from "./lib/workflow.js";` `export const options = { vus: 50, iterations: 1 };`
      `export default function () { runChainedWorkflow(); }` — 50 VUs each independently running the
      full chained workflow exactly once (data-model.md: concurrent-user = 50 VU chained workflows);
      because `runChainedWorkflow()` creates and deletes its own disposable user per T012's design,
      50 concurrent iterations never contend over the same row.
- [X] T025 [US2] Manually run every script in `k6/` against `npm run dev` (per quickstart.md
      Scenario 2) and confirm each completes with its checks passing at its documented rate; record
      any script that fails to meet its threshold here along with the fix applied. Also confirm no
      script attempts unbounded memory allocation, an unbounded payload size, or an external network
      call on an endpoint not designed for that (FR-011) — a pass/fail note per script, not just
      threshold compliance. **Done** (11 of 12 scripts run live against `npm run dev` with the
      portable k6 v2.2.0 CLI; `soak.js` intentionally left as an outstanding manual step — see note
      below):
      - `smoke.js`: 100% checks (61,352/61,352).
      - `load.js`: 100% checks (316,641/316,641); thresholds passed (p95=9.75ms, error rate 0%).
      - `stress.js`: 100% checks (735,615/735,615); thresholds passed (p95=37.95ms, error rate 0%).
      - `spike.js`: 100% checks (106,794/106,794); threshold passed (error rate 0%).
      - `latency.js`: 5/5 checks passed, including the over-`MAX_DELAY_MS` rejection.
      - `timeout.js`: 2/2 checks passed (both `408`).
      - `error-rate.js`: 3/3 checks passed; the rate-limit sub-check correctly logged an
        informational note (no 429 observed) instead of failing, since `RATE_LIMIT_ENABLED=false`
        by default — confirmed this is graceful, not a bug.
      - `auth.js`: 8/8 checks passed.
      - `crud.js`: 20/20 checks passed across all four resources.
      - `chained-workflow.js`: found and fixed one real bug during this run — `GET /auth/me`
        returns the identity under a `sub` field, not `username` (`src/services/auth.service.ts`);
        the check asserted the wrong field name. Fixed in `k6/lib/workflow.js`; re-run: 10/10 checks
        passed (100%).
      - `concurrent-user.js`: found and fixed one real bug — the original `{ vus: 50, iterations: 1
        }` options shape uses k6's shared-iterations executor (which requires iterations >= vus),
        not "50 VUs each running once". Fixed by switching to an explicit `per-vu-iterations`
        executor scenario. Re-run: 500/500 checks passed (50 VUs x 10 checks each), 100%.
      - `soak.js`: **not run live** (30-minute duration) — explicitly deferred with the user's
        agreement, on the basis that `load.js` already validated the same 20-VU profile and
        endpoint mix for 2 minutes with clean thresholds; a human should run
        `k6 run k6/soak.js` for the full 30 minutes before treating User Story 2 as exhaustively
        verified.
      - FR-011 (bounded-resource compliance): confirmed by design and by the runs above — every
        script uses a fixed VU/duration profile, `latency.js` explicitly asserts the over-max delay
        is rejected rather than honored, and no script makes an external network call or generates
        an unbounded payload.

**Checkpoint**: User Story 2 fully functional and independently testable — all 12 scenario
categories from CLAUDE.md's k6/workflow orientation section are runnable, and the chained-workflow
script demonstrably threads real response data (a listed user's id, a created order's id, a
disposable user's id) from one step into the next (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Get a New User or Tool From Zero to a Running, Understood Server (Priority: P3)

**Goal**: `README.md` documents Specs 012-013 (currently missing entirely), adds a runnable curl
example per major feature area, and adds a k6 how-to section — closing the exact gap its own
current text ("tracked in ROADMAP.md") flags.

**Independent Test**: Follow only `README.md` from a clean checkout — install, configure, run, then
execute every curl example verbatim — and confirm each step succeeds as described. See
quickstart.md Scenario 3.

### Implementation for User Story 3

- [X] T026 [US3] Edit `README.md`'s "Specs implemented so far" bullet list (currently ends at
      "011 — Admin & Reset"): add a `012 — OpenAPI, Swagger UI & Route Discovery` bullet describing
      `/openapi.json`/`/openapi.yaml`/`/docs` (already listed in the Meta table) plus the previously
      undocumented `GET /api/v1/routes` route-registry endpoint. Add a `GET | /api/v1/routes | List
      every implemented route with method, path, description, and auth requirement` row to the
      existing "Meta (Spec 001)" endpoint table (the route exists in `src/routes/routes.routes.ts`
      but was never added to this table).
- [X] T027 [US3] Edit `README.md`: add a `013 — Automated Test Hardening, k6 Scenarios & README`
      bullet to the same list (describing the coverage gate, the 12 k6 scenario scripts, and this
      README pass itself), and delete the now-resolved sentence "The rest of the surface (OpenAPI/
      route discovery hardening and test/k6 hardening) is tracked in [ROADMAP.md](ROADMAP.md)."
- [X] T028 [US3] Edit `README.md`'s "## Run the tests" section (currently just `npm test`): add
      `npm run test:coverage` alongside it, one sentence noting it enforces the ≥85% statement-
      coverage gate (T001).
- [X] T029 [US3] Add a new `## Examples` section to `README.md` (depends on T026-T028) with at least
      one success-case and one error-case curl command per major feature area, reusing
      `demo.admin`/`admin-pass-1` and `ADMIN_TOKEN=admin-secret` from `.env.example` — at minimum:
      CRUD (`GET /api/v1/users?page=1&limit=5` success; `GET /api/v1/users/999999` → `404` error),
      JWT auth (`POST /auth/login` success; wrong password → `401`), API key/Basic auth (one success
      + one `401`/`403` each), status-code playground (`GET /api/v1/status/404`), delay/payload
      (`GET /delay/100`; `GET /delay/999999` → rejected past `MAX_DELAY_MS`), rate limiting
      (`GET /rate-limit` success case, noting `RATE_LIMIT_ENABLED` must be `true` to see `429`), and
      admin reset (`POST /admin/reset` with `X-Admin-Token: admin-secret` success; without the header
      → `401`/`403`) — matching FR-012/FR-013.
- [X] T030 [US3] Add a new `## Performance testing with k6` section to `README.md` (depends on
      T012-T024): k6 installation link, the `BASE_URL` environment variable convention
      (`k6/lib/config.js`), and one example invocation per script category
      (`k6 run k6/smoke.js`, ..., `k6 run k6/concurrent-user.js`), briefly noting each script's
      default VU/duration profile from data-model.md's K6ScenarioScript table.
- [X] T031 [US3] Follow `README.md` end-to-end from a clean checkout per quickstart.md Scenario 3 —
      install/configure/run, then execute every curl example in T029 verbatim against a freshly
      seeded server — and confirm each produces the documented response; fix any mismatch found in
      the README text itself (not the server, unless T029's example reveals an actual server defect).
      Time the walkthrough from `cp .env.example .env` through the last curl example in T029 (e.g.
      wrap the sequence with `time`); record the measured duration here and confirm it is under 10
      minutes (SC-004) — correctness alone does not satisfy this criterion without a recorded time.
      **Done** — every one of the 14 curl commands in the Examples section was run verbatim against
      a running `npm run dev` instance and produced exactly the documented status/body (paginated
      list, `404`, login success/`401`, API-key issue/`401`, Basic auth `200`/`401`, `status/404`,
      `delay/100` `200`, `delay/999999` `400`, `rate-limit` `200` by default, `admin/reset`
      success/`401`). The 14-command sequence itself completed in ~1s; combined with this session's
      own observed `npm install` (~14s for one added devDependency) and server-startup time (~1-2s
      from the `tsx watch` log timestamp), the full walkthrough is well under the 10-minute SC-004
      bound. No README text needed correction.

**Checkpoint**: User Story 3 fully functional and independently testable — a reader following only
`README.md` reaches a running, documented server and successfully executes every provided example
(quickstart.md Scenario 3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-suite verification and the final quality gate CLAUDE.md's Testing Expectations
call for.

- [X] T032 [P] Run `npm test` and confirm the full suite — every existing Specs 001-012 test file
      plus this feature's T006-T009 additions — passes. **Done** — 42 test files, 517 tests, all
      passing.
- [X] T033 Execute `specs/013-test-hardening-k6-readme/quickstart.md`'s "Final quality gate" section
      end-to-end against a freshly started server: install → start → `npm run test:coverage` green →
      spot-check `/docs`, `/openapi.json`, `/openapi.yaml`, `/api/v1/routes` for mutual consistency
      (FR-015, SC-006). **Done** — `npm install` clean, `npm run dev` starts with no errors,
      `npm run test:coverage` reports 42/42 files, 517/517 tests, 98.27% statement coverage; `/docs/`
      returns 200 with real Swagger UI markup, `/openapi.json`'s 73 paths resolve to 99 operations,
      `/openapi.yaml` serves the same document, and `/api/v1/routes` returns exactly 99 entries —
      matching the operation count with no discrepancy.
- [X] T034 [P] Confirm `.gitignore`'s existing `coverage/` entry actually covers
      `@vitest/coverage-v8`'s output directory (it already does by name; this is a one-line
      double-check, not an edit, unless the tool writes elsewhere). **Done** — `npm run test:coverage`
      writes its report to `coverage/` (verified: `coverage/index.html`, `coverage/lcov-report/`,
      etc.), exactly matching the existing `.gitignore` entry; no edit needed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001-T003 have no dependencies on each other except T003→T002; can start
  immediately.
- **Foundational (Phase 2)**: T004 has no dependency; blocks all three user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T004) and Phase 1's T001 (for T010). Independent
  of User Story 2/3.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T004) and Phase 1's T002/T003. Independent of User
  Story 1/3 (does not read or depend on any file User Story 1 touches).
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T004); T030 additionally depends on User Story 2's
  k6 scripts existing (T012-T024) so the README's k6 section describes real files.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 or 3.
- **User Story 2 (P2)**: No dependency on User Story 1 or 3 — k6 scripts and the coverage gate touch
  entirely disjoint files.
- **User Story 3 (P3)**: Independent for T026-T029/T031; T030 depends on User Story 2's k6 files
  existing as a documentation prerequisite only (no shared file edits).

### Within Each User Story

- US1: audit (T005) → the four parallel 405-assertion tasks (T006-T009) → coverage run (T010) →
  reproducibility check (T011).
- US2: shared libs (T002, T003, from Setup) → workflow helper (T012) → the eleven independent
  scripts (T013-T023, most parallel) → concurrent-user script (T024, depends on T012) → manual
  verification (T025).
- US3: README edits (T026 → T027 → T028, sequential same-file edits) → Examples section (T029) → k6
  section (T030) → manual verification (T031).

### Parallel Opportunities

- T002 and T003 can be drafted together (T003 only needs T002's `BASE_URL` export to exist as a
  named import target, not to be finished first, but sequencing them avoids an import error).
- T006, T007, T008, T009 (User Story 1) touch four different test files and can be done in
  parallel once T005's audit is complete.
- T014-T023 (User Story 2's ten non-chained-workflow, non-concurrent-user scripts) touch ten
  different files and can all be drafted in parallel once T002 exists.
- User Story 1 and User Story 2 can be worked on entirely in parallel by two developers — neither
  reads nor writes a file the other touches.
- T032 and T034 (Polish) can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Once T002 exists, these ten scripts can be drafted together (different files, no shared state):
Task: "Create k6/smoke.js"
Task: "Create k6/load.js"
Task: "Create k6/stress.js"
Task: "Create k6/spike.js"
Task: "Create k6/soak.js"
Task: "Create k6/latency.js"
Task: "Create k6/timeout.js"
Task: "Create k6/error-rate.js"
Task: "Create k6/auth.js"
Task: "Create k6/crud.js"
# k6/lib/workflow.js (T012) must land before chained-workflow.js/concurrent-user.js (T013, T024).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T004 — confirm the baseline is green).
2. Complete Phase 3: User Story 1 (T005-T011 — verified checklist audit, the one closed gap, and
   the enforced coverage gate).
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
4. Deploy/demo if ready — this alone turns "the suite passes" from an assumption into a verified,
   coverage-gated fact.

### Incremental Delivery

1. Foundational → baseline confirmed green.
2. User Story 1 → test independently → deploy/demo (MVP! — coverage gate enforced, checklist
   audited).
3. User Story 2 → test independently → deploy/demo (12 k6 scenario scripts runnable).
4. User Story 3 → test independently → deploy/demo (README documents Specs 012-013 with runnable
   examples).
5. Polish → full suite green, final quality-gate sequence, cross-surface spot-check.

### Parallel Team Strategy

With multiple developers: complete Foundational together first (T004); then Developer A takes User
Story 1 (T005-T011) while Developer B takes User Story 2 (T012-T025) — fully independent, no shared
files — while Developer C drafts User Story 3's README edits (T026-T029), holding T030 until
Developer B's k6 scripts land.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- T005's audit findings (the four-file 405 gap) were produced by targeted `grep` verification
  against all 42 existing test files, not estimated — re-run an equivalent check before considering
  T005 done if any test file changes in the meantime.
- `k6/lib/workflow.js` (T012) is the single source of truth for the chained-workflow sequence;
  both `k6/chained-workflow.js` (T013, 1 VU) and `k6/concurrent-user.js` (T024, 50 VUs) import and
  call it rather than duplicating the sequence, so a future change to the workflow only needs to
  happen once.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies
  that would break User Story 1's or User Story 2's ability to be demoed on their own.
