---

description: "Task list template for feature implementation"
---

# Tasks: Error Simulation & Generic Scenario Endpoint

**Input**: Design documents from `/specs/010-error-simulation-scenario-endpoint/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/error-simulation.openapi.yaml](contracts/error-simulation.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. CLAUDE.md's Testing Expectations explicitly requires coverage for "status
codes" and this spec's own endpoints, and the constitution's Quality Gates ("new or changed
endpoints MUST include corresponding automated test coverage ... before being considered done")
make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. Unlike prior specs, User Story 1 (`/errors/*`) and User
Story 2 (`GET /api/v1/test`'s core dispatch) share two Foundational prerequisites (the scenario
catalog and the extracted status-code renderer) because FR-005 requires their outcomes to be
structurally guaranteed to match — not two independently-authored copies of the same nine
status/error-code mappings. User Story 3 (delay/large-response/failureRate) then additively
extends User Story 2's own new files (`testScenarioRequest.ts`, `testScenario.service.ts`,
`testScenario.controller.ts`, `tests/testScenario.test.ts`) — exactly as spec.md's own "depends on
User Story 2's scenario dispatch but is independently testable" framing describes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-009 layout. No new top-level directories. `src/app.ts` is touched twice (once per story, small
additive mounts). `src/services/statusCode.service.ts` and `src/controllers/statusCode.controller.ts`
(Spec 004) gain one small, additive, behavior-preserving change each in Foundational — no other
prior spec's file is touched.

---

## Phase 1: Setup

**Purpose**: Project initialization and new dependencies.

No tasks. This feature adds no new npm dependency — every new module reuses existing project
patterns (`utils/*Param.ts` hand-rolled validators, the existing `zod`-free style already used by
`delayMsParam.ts`/`statusCodeParam.ts`/`payloadPresetParam.ts`). Proceed directly to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 [P] Create `src/data/testScenarios.catalog.ts` (data-model.md): `export const
      TEST_SCENARIOS = ["success", "validation-error", "unauthorized", "forbidden", "not-found",
      "conflict", "rate-limit", "server-error", "service-unavailable", "timeout", "delayed",
      "large-response"] as const;` `export type TestScenario = (typeof TEST_SCENARIOS)[number];`
      `export const SCENARIO_FIXED_STATUS: Partial<Record<TestScenario, number>> = {
      "validation-error": 400, unauthorized: 401, forbidden: 403, "not-found": 404, conflict: 409,
      "rate-limit": 429, "server-error": 500, "service-unavailable": 503, timeout: 408 };` `export
      const FAILURE_REPRESENTING_SCENARIOS: readonly TestScenario[] = ["server-error",
      "service-unavailable", "rate-limit", "timeout"];` `export const ERROR_ENDPOINT_SCENARIOS:
      Record<string, TestScenario> = { validation: "validation-error", "not-found": "not-found",
      conflict: "conflict", unauthorized: "unauthorized", forbidden: "forbidden", "rate-limit":
      "rate-limit", "server-error": "server-error", "service-unavailable": "service-unavailable",
      timeout: "timeout" };` (research.md Decisions 1-2 — the single source of truth both `/errors/*`
      and the named scenarios read from, so FR-005 parity is structural, not just "tested for
      today").
- [ ] T002 [P] Extract `renderStatusCodeDemo` in `src/services/statusCode.service.ts` (research.md
      Decision 3): add `import type { Response } from "express"; import { config } from
      "../config"; import { buildErrorEnvelope } from "../models/errorEnvelope";` and export
      `function renderStatusCodeDemo(demo: StatusCodeDemo, requestId: string, res: Response): void`
      containing **exactly** the existing `switch (demo.shape)` body currently inline in
      `src/controllers/statusCode.controller.ts`'s `demonstrateStatusCode` (the `"success"`,
      `"noBody"`, `"redirect"` — using `` `${config.apiPrefix}/status/200` `` as the `Location`
      target, unchanged — and `"error"` branches, verbatim, no behavior change). Then rewrite
      `statusCode.controller.ts`'s `demonstrateStatusCode` to: `const code =
      parseStatusCodeParam(req.params.code); const demo = getStatusCodeDemo(code);
      renderStatusCodeDemo(demo, requestIdOf(req), res);` — removing its now-unused
      `buildErrorEnvelope`/`config` imports if no longer referenced directly in the controller.
      Confirm `tests/statusCodes.test.ts` still passes unmodified (pure refactor, no behavior
      change).

**Checkpoint**: Foundation ready — both user stories below can now be implemented.

---

## Phase 3: User Story 1 - Trigger a Specific Error Deterministically (Priority: P1) 🎯 MVP

**Goal**: Nine dedicated `GET /errors/*` endpoints, each always returning one fixed status code and
error envelope, regardless of any header/body/credential supplied.

**Independent Test**: Call each of the nine endpoints in isolation and confirm each always returns
its documented status/error code, with no setup and no dependency on any other endpoint. See
quickstart.md Scenario 1.

### Implementation for User Story 1

- [ ] T003 [US1] Create `src/controllers/errors.controller.ts` (depends on T001, T002): `import
      type { Request, Response } from "express"; import { getStatusCodeDemo, renderStatusCodeDemo
      } from "../services/statusCode.service"; import { requestIdOf } from
      "../middleware/requestId"; import { ERROR_ENDPOINT_SCENARIOS, SCENARIO_FIXED_STATUS } from
      "../data/testScenarios.catalog";` export `function makeErrorEndpointHandler(pathSegment:
      keyof typeof ERROR_ENDPOINT_SCENARIOS)` that resolves `const scenario =
      ERROR_ENDPOINT_SCENARIOS[pathSegment]; const demo = getStatusCodeDemo
      (SCENARIO_FIXED_STATUS[scenario] as number);` once at module-load time (a static lookup, not
      per-request), and returns `function handleErrorEndpoint(req: Request, res: Response): void {
      renderStatusCodeDemo(demo, requestIdOf(req), res); }` (FR-001 — every response shape here is
      `"error"`, so `renderStatusCodeDemo` reduces to `buildErrorEnvelope` + any `extraHeaders`,
      e.g. `429`'s `Retry-After: "60"` from `STATUS_CODE_DEMOS`, FR-002; ignores every
      header/body/credential on the request, FR-001/FR-003).
- [ ] T004 [US1] Create `src/routes/errors.routes.ts` (depends on T003): `import { Router } from
      "express"; import { makeErrorEndpointHandler } from "../controllers/errors.controller";
      import { methodNotAllowedHandler } from "../middleware/methodNotAllowed"; import {
      ERROR_ENDPOINT_SCENARIOS } from "../data/testScenarios.catalog"; export const errorsRouter =
      Router({ strict: true }); for (const pathSegment of Object.keys(ERROR_ENDPOINT_SCENARIOS)) {
      const path = `/errors/${pathSegment}`; errorsRouter.get(path,
      makeErrorEndpointHandler(pathSegment)); errorsRouter.all(path, methodNotAllowedHandler); }`
      — generates all nine routes from the same table used by T003, so no path segment can be
      typo'd out of sync with `ERROR_ENDPOINT_SCENARIOS`.
- [ ] T005 [US1] Wire `errorsRouter` into `src/app.ts` (depends on T004): `import { errorsRouter }
      from "./routes/errors.routes";` and `app.use(errorsRouter);` mounted top-level, alongside
      `delayRouter`/`rateLimitRouter`/`flakyRouter`/etc. (research.md Decision 8 — CLAUDE.md spells
      `/errors/*` with no `/api/v1` prefix).
- [ ] T006 [P] [US1] Create `tests/errorScenarios.test.ts` (depends on T005): for each of
      `validation`→400/`VALIDATION_ERROR`, `not-found`→404/`RESOURCE_NOT_FOUND`,
      `conflict`→409/`CONFLICT`, `unauthorized`→401/`UNAUTHORIZED`, `forbidden`→403/`FORBIDDEN`,
      `rate-limit`→429/`RATE_LIMIT_EXCEEDED` (assert `Retry-After` header present),
      `server-error`→500/`INTERNAL_ERROR`, `service-unavailable`→503/`SERVICE_UNAVAILABLE`,
      `timeout`→408/`REQUEST_TIMEOUT`: `GET /errors/<path>` returns that exact status/code, and
      repeating the same call is identical every time (FR-001, SC-001). `GET /errors/unauthorized`
      and `GET /errors/forbidden` with a valid-looking `Authorization: Bearer ...` header still
      return `401`/`403` unchanged (spec.md Edge Cases — unconditional simulation). `POST
      /errors/not-found` → `405` via `methodNotAllowedHandler`.

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md
Scenario 1).

---

## Phase 4: User Story 2 - Drive an End-to-End Test Flow Through One Configurable Endpoint (Priority: P2)

**Goal**: `GET /api/v1/test?scenario=` dispatches to the same nine fixed outcomes as `/errors/*`
(plus `success`), rejects an unrecognized `scenario` with `400`, and supports a `status` escape
hatch (any of the 24 status-code-playground codes) when no conflicting named scenario is given.

**Independent Test**: Call `?scenario=success` (expect `200`), each of the nine named failure
scenarios (expect the matching `/errors/*` code), an unrecognized scenario (expect `400`), and
`?status=204`/`?status=301` (expect the full status-code-playground shape). See quickstart.md
Scenario 2.

### Implementation for User Story 2

- [ ] T007 [P] [US2] Add `parseOptionalStatusCodeParam` to `src/utils/statusCodeParam.ts`
      (research.md Decision 4; additive, `parseStatusCodeParam` itself unchanged): `export function
      parseOptionalStatusCodeParam(raw: unknown): number | undefined { if (raw === undefined)
      return undefined; if (typeof raw !== "string") { throw new HttpError(400,
      "VALIDATION_ERROR", `Invalid 'status' value: must be a single string value.`, { field:
      "status", value: raw }); } return parseStatusCodeParam(raw); }` — reuses 100% of the
      existing strict-integer/range/documented-code validation.
- [ ] T008 [P] [US2] Create `src/models/testScenarioRequest.ts` (depends on T001, T007): `import {
      HttpError } from "../utils/httpError"; import { parseOptionalStatusCodeParam } from
      "../utils/statusCodeParam"; import { TEST_SCENARIOS, SCENARIO_FIXED_STATUS, type TestScenario
      } from "../data/testScenarios.catalog";` export `function parseScenarioParam(raw: unknown):
      TestScenario` — returns `"success"` when `raw === undefined` (FR-004); throws `HttpError(400,
      "VALIDATION_ERROR", ..., { field: "scenario", value: raw, supportedScenarios: TEST_SCENARIOS
      })` listing `TEST_SCENARIOS.join(", ")` when `raw` is not a string or not one of
      `TEST_SCENARIOS` (FR-006). Export `function resolveStatusOverride(rawStatus: unknown,
      scenario: TestScenario): number | undefined` — `const status =
      parseOptionalStatusCodeParam(rawStatus); if (status === undefined) return undefined; const
      fixed = SCENARIO_FIXED_STATUS[scenario]; if (fixed !== undefined && status !== fixed) { throw
      new HttpError(400, "VALIDATION_ERROR", `status ${status} conflicts with scenario
      '${scenario}' (expected ${fixed}).`, { field: "status", value: status, scenario, expected:
      fixed }); } return status;` (FR-008 — a `status` equal to the scenario's own fixed code is
      accepted as redundant; any other value for a scenario with a fixed code is rejected;
      `success`/`delayed`/`large-response` — no `fixed` entry — never conflict, per the
      Clarifications session).
- [ ] T009 [US2] Create `src/services/testScenario.service.ts` (depends on T001): `import {
      getStatusCodeDemo } from "./statusCode.service"; import { SCENARIO_FIXED_STATUS, type
      TestScenario } from "../data/testScenarios.catalog";` export `function
      resolveScenarioOutcome(scenario: TestScenario, statusOverride: number | undefined):
      StatusCodeDemo { const fixedStatus = SCENARIO_FIXED_STATUS[scenario]; return
      getStatusCodeDemo(fixedStatus ?? statusOverride ?? 200); }` (research.md Decision 1 — a named
      scenario's own fixed status always wins; otherwise the caller's `status` override applies;
      otherwise the plain `200` success demo. At this stage `scenario` can only be one of the nine
      fixed-status names or `"success"`/`"delayed"`/`"large-response"` — the latter two are not yet
      special-cased and simply behave like `"success"` until User Story 3 adds their real
      behavior).
- [ ] T010 [US2] Create `src/controllers/testScenario.controller.ts` (depends on T008, T009, T002):
      `import type { Request, Response } from "express"; import { parseScenarioParam,
      resolveStatusOverride } from "../models/testScenarioRequest"; import { resolveScenarioOutcome
      } from "../services/testScenario.service"; import { renderStatusCodeDemo } from
      "../services/statusCode.service"; import { requestIdOf } from "../middleware/requestId";`
      export `function getTestScenario(req: Request, res: Response): void { const scenario =
      parseScenarioParam(req.query.scenario); const statusOverride =
      resolveStatusOverride(req.query.status, scenario); const demo =
      resolveScenarioOutcome(scenario, statusOverride); renderStatusCodeDemo(demo,
      requestIdOf(req), res); }` (FR-004 through FR-008 — full success/noBody/redirect/error shape
      support via the shared renderer, T002).
- [ ] T011 [US2] Create `src/routes/testScenario.routes.ts` (depends on T010): `import { Router }
      from "express"; import * as testScenarioController from
      "../controllers/testScenario.controller"; import { methodNotAllowedHandler } from
      "../middleware/methodNotAllowed"; export const testScenarioRouter = Router({ strict: true
      }); testScenarioRouter.get("/test", testScenarioController.getTestScenario);
      testScenarioRouter.all("/test", methodNotAllowedHandler);`.
- [ ] T012 [US2] Wire `testScenarioRouter` into the existing versioned `apiRouter` in `src/app.ts`
      (depends on T011): `import { testScenarioRouter } from "./routes/testScenario.routes";` and
      `apiRouter.use(testScenarioRouter);` alongside `statusCodeRouter`/etc., so its full path is
      `${config.apiPrefix}/test` (research.md Decision 8).
- [ ] T013 [P] [US2] Create `tests/testScenario.test.ts` (depends on T012): `GET
      /api/v1/test?scenario=success` and `GET /api/v1/test` (omitted) → both `200`; each of
      `validation-error`→400, `unauthorized`→401, `forbidden`→403, `not-found`→404, `conflict`→409,
      `rate-limit`→429, `server-error`→500, `service-unavailable`→503, `timeout`→408 → matches
      `tests/errorScenarios.test.ts`'s corresponding `/errors/*` result exactly (FR-005, SC-002);
      `?scenario=bogus` → `400` `VALIDATION_ERROR` listing supported scenario names (FR-006);
      `?status=204` → `204` with no body; `?status=301` → `301` with a `Location` header and
      `StatusDemoRedirect`-shaped body (FR-007); `?scenario=not-found&status=404` → `404` (redundant,
      accepted); `?scenario=not-found&status=400` → `400` `VALIDATION_ERROR` (conflict, FR-008).

**Checkpoint**: User Stories 1 and 2 both work independently (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Compose Timing, Payload Size, and Failure Probability Into a Test Step (Priority: P3)

**Goal**: `scenario=delayed` waits a bounded `delay` ms before responding; `scenario=large-response`
returns Spec 007's exact "large" preset payload; the four failure-representing scenarios
(`server-error`, `service-unavailable`, `rate-limit`, `timeout`) accept an optional `failureRate`
that tunes the observed failure proportion, defaulting to always-fail when omitted.

**Independent Test**: `?scenario=delayed&delay=500` waits ≥500ms; `?scenario=large-response`
returns a ~1MB body; `?scenario=server-error&failureRate=0`/`1` are single-outcome-deterministic;
omitting `failureRate` matches `/errors/server-error` (always `500`). See quickstart.md Scenario 3.

### Implementation for User Story 3

- [ ] T014 [P] [US3] Extend `src/models/testScenarioRequest.ts` (depends on T008): add `import {
      parseFailureRateParam } from "./flakyRequests"; import { FAILURE_REPRESENTING_SCENARIOS }
      from "../data/testScenarios.catalog";` and export `function resolveFailureRate(raw: unknown,
      scenario: TestScenario): number { if (!(FAILURE_REPRESENTING_SCENARIOS as readonly
      string[]).includes(scenario)) return 1; return parseFailureRateParam(raw, 1); }` — for any
      scenario **not** in `FAILURE_REPRESENTING_SCENARIOS`, returns `1` immediately **without**
      parsing/validating `raw` at all, so a garbage `failureRate` never causes a `400` for those
      scenarios (FR-013 — "regardless of any failureRate supplied"); otherwise defaults to `1`
      (always fail) rather than `config.failureRate`, so a bare `scenario=server-error` matches
      `/errors/server-error` exactly (research.md Decision 6, FR-011).
- [ ] T015 [P] [US3] Extend `src/services/testScenario.service.ts` (depends on T009): add `import {
      nextRandom } from "../utils/seededRandom"; import { FAILURE_REPRESENTING_SCENARIOS } from
      "../data/testScenarios.catalog";` export `type ScenarioOutcome = { kind: "demo"; demo:
      StatusCodeDemo } | { kind: "plainSuccess" };` export `function rollScenarioFailure
      (failureRate: number, draw: () => number = nextRandom): boolean { return draw() <
      failureRate; }` (research.md Decision 5 — a single draw against the shared seeded PRNG, not
      `rollFlakyOutcome`, since there is nothing to pick from). Rewrite `resolveScenarioOutcome` to
      `function resolveScenarioOutcome(scenario: TestScenario, statusOverride: number | undefined,
      failureRate: number): ScenarioOutcome { const fixedStatus = SCENARIO_FIXED_STATUS[scenario];
      if (fixedStatus !== undefined) { const isFailureRepresenting =
      (FAILURE_REPRESENTING_SCENARIOS as readonly string[]).includes(scenario); const failed =
      !isFailureRepresenting || rollScenarioFailure(failureRate); if (!failed) { return { kind:
      "plainSuccess" }; } return { kind: "demo", demo: getStatusCodeDemo(fixedStatus) }; } return {
      kind: "demo", demo: getStatusCodeDemo(statusOverride ?? 200) }; }` — for a scenario **not**
      in `FAILURE_REPRESENTING_SCENARIOS` (i.e. one of the five deterministic-error names), `failed`
      short-circuits to `true` **without calling `rollScenarioFailure` at all**, so the shared
      PRNG's sequence is never consumed for those (mirrors `rollFlakyOutcome`'s disabled-mode
      no-draw pattern, FR-013); this function is only ever called for a scenario that already has a
      `fixedStatus`, or `"success"` — the controller (T016) now handles `"delayed"`/
      `"large-response"` before ever reaching this function.
- [ ] T016 [US3] Extend `src/controllers/testScenario.controller.ts` (depends on T014, T015): add
      `import { config } from "../config"; import { parseDelayMsParam } from
      "../utils/delayMsParam"; import { resolveFailureRate } from
      "../models/testScenarioRequest"; import { generatePayload } from
      "../services/payload.service"; import { PAYLOAD_SIZE_PRESET_BYTES } from
      "../data/payloadPresets.catalog";` Rewrite `getTestScenario` to, immediately after resolving
      `scenario`/`statusOverride`: `if (scenario === "delayed") { const delayMs =
      parseDelayMsParam(req.query.delay, config.maxDelayMs); const status = statusOverride ?? 200;
      setTimeout(() => { res.status(status).json({ scenario, status, delayMs }); }, delayMs);
      return; }` (FR-009 — reuses `config.maxDelayMs` and the exact Spec 007 validator, mirroring
      `delay.controller.ts`'s non-`async`/`setTimeout` pattern so no promise ever enters Express's
      synchronous route-handling path); `if (scenario === "large-response") { const status =
      statusOverride ?? 200; const payload = generatePayload(PAYLOAD_SIZE_PRESET_BYTES.large);
      res.status(status).json({ scenario, status, ...payload }); return; }` (FR-010 — reuses Spec
      007's exact "large" preset size and generator, per the Clarifications session — no
      independent size definition). Otherwise (any of the ten remaining scenarios): `const
      failureRate = resolveFailureRate(req.query.failureRate, scenario); const outcome =
      resolveScenarioOutcome(scenario, statusOverride, failureRate); if (outcome.kind === "demo") {
      renderStatusCodeDemo(outcome.demo, requestIdOf(req), res); return; }
      res.status(200).json({ scenario, status: 200 });` (the `"plainSuccess"` branch — a
      failure-representing scenario that rolled a simulated success).
- [ ] T017 [P] [US3] Extend `tests/testScenario.test.ts` (depends on T016): timing —
      `?scenario=delayed&delay=200` measured elapsed time ≥200ms (use `Date.now()` before/after the
      `supertest` call); `?scenario=delayed&delay=<value exceeding config.maxDelayMs>` → `400`
      (FR-009's rejection path, no actual wait). Payload — `?scenario=large-response` response body
      length equals `PAYLOAD_SIZE_PRESET_BYTES.large` (`1_048_576`) (FR-010). Failure rate —
      `?scenario=server-error&failureRate=0` → `200` on repeated calls; `?scenario=server-error&
      failureRate=1` → `500` on repeated calls; `?scenario=server-error` (omitted) → `500` always,
      matching `/errors/server-error` (FR-011, research.md Decision 6); `?scenario=timeout&
      failureRate=2`/`-1`/`abc` → `400`; a non-failure-representing scenario with a garbage
      `failureRate` (e.g. `?scenario=not-found&failureRate=abc`) → still `404`, `failureRate` fully
      ignored, no `400` (FR-013). Reproducibility — call `resetStores()` (via the existing
      `beforeEach`), draw five outcomes via repeated `?scenario=timeout&failureRate=0.5` calls into
      an array of statuses, reset again, repeat, `expect(arrayA).toEqual(arrayB)` (SC-004, mirroring
      `tests/flaky.test.ts`'s existing reproducibility pattern).

**Checkpoint**: All three user stories independently functional (quickstart.md Scenario 3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [ ] T018 [P] Merge `contracts/error-simulation.openapi.yaml`'s `tags`, `paths`,
      `components.schemas` (`TestScenarioResult`), and `components.responses` (`ServerError`,
      `ServiceUnavailable`, `RequestTimeout`) into the root `openapi.yaml`, reusing the existing
      `Error`/`ValidationError`/`NotFound`/`Unauthorized`/`Forbidden`/`RateLimited`/`Conflict`/
      `StatusDemoSuccess`/`StatusDemoRedirect` schemas/responses rather than duplicating them, so
      `/docs`, `/openapi.json`, and `/openapi.yaml` document exactly the 10 operations this spec
      implements (constitution: Quality Gates & Spec Parity). No `allOf`/`oneOf`/`anyOf`
      combinators (project memory: OpenAPI spec must avoid combinators).
- [ ] T019 Run `npm test` and confirm the full suite — Specs 001-009's existing tests (including
      `tests/statusCodes.test.ts` unchanged after T002's refactor, and `tests/flaky.test.ts`
      unaffected since `resolveScenarioOutcome`'s `rollScenarioFailure` draws from the same shared
      PRNG but is exercised only via this feature's own new tests) plus `tests/errorScenarios.test.ts`
      and `tests/testScenario.test.ts` — passes.
- [ ] T020 Execute the manual validation scenarios in
      `specs/010-error-simulation-scenario-endpoint/quickstart.md` against a running `npm run dev`
      server and confirm every expected status code, header, and body.
- [ ] T021 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 10
      new operations correctly with no schema errors; confirm `/openapi.json` lists exactly the
      nine `/errors/*` paths plus `/api/v1/test`, and every `$ref` in them resolves. Note: `GET
      /api/v1/routes` is not yet implemented in this codebase (Spec 012's deliverable per the
      roadmap).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks — no new dependency needed.
- **Foundational (Phase 2)**: T001 and T002 have no dependency on each other (different files) but
  both **block** every task in Phases 3-5.
- **User Story 1 (Phase 3)**: Depends only on Phase 2. No dependency on User Story 2 or 3.
- **User Story 2 (Phase 4)**: Depends only on Phase 2. No dependency on User Story 1; independent
  of it (separate router/controller/files), though both read the same Phase 2 catalog/renderer.
- **User Story 3 (Phase 5)**: Depends on User Story 2's files (T008-T012) — extends them
  additively, per spec.md's own "depends on User Story 2's scenario dispatch" framing. No
  dependency on User Story 1.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 or 3 in this spec.
- **User Story 2 (P2)**: No dependency on User Story 1; independently testable on its own files.
- **User Story 3 (P3)**: Extends User Story 2's files; not implementable before User Story 2, but
  independently *testable* once built (its own acceptance scenarios don't touch `/errors/*`).

### Within Each User Story

- US1: controller (depends on Foundational) → routes → `app.ts` wiring → tests.
- US2: status-param util + request-parsing model (parallel) → service → controller → routes →
  `app.ts` wiring → tests.
- US3: request-parsing extension + service extension (parallel, different files) → controller
  extension (depends on both) → test extension.

### Parallel Opportunities

- T001 and T002 (Foundational) run in parallel (different files).
- Once Foundational completes, User Story 1 (Phase 3) and User Story 2 (Phase 4) can proceed fully
  in parallel with each other — coordinate `src/app.ts` edits sequentially (or merge carefully)
  since each story's edit to it is a small, independent addition.
- Within US2: T007 and T008 run in parallel (T008 depends on T007's export existing, but as a
  design decision both can be drafted together and reconciled before T009).
- Within US3: T014 and T015 run in parallel (different files); T016 depends on both.
- T018 and T021 (Polish) run in parallel; T019 and T020 are sequential whole-suite/manual checks
  that should follow T018.

---

## Parallel Example: User Stories 1 and 2

```bash
# Once Phase 2 (Foundational) completes, both stories can start immediately:
Task: "Implement GET /errors/* end-to-end (User Story 1)"
Task: "Implement GET /api/v1/test's core scenario/status dispatch end-to-end (User Story 2)"
# User Story 3 then extends User Story 2's own files once Phase 4 is done.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T002 — blocks everything).
2. Complete Phase 3: User Story 1 (the nine dedicated `/errors/*` endpoints, full test coverage).
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
4. Deploy/demo if ready — this alone gives testing tools nine dedicated, deterministic failure
   endpoints to assert against.

### Incremental Delivery

1. Foundational → both stories' shared catalog/renderer ready.
2. User Story 1 → test independently → deploy/demo (MVP!).
3. User Story 2 → test independently → deploy/demo (the primary k6 hook's core dispatch).
4. User Story 3 → test independently → deploy/demo (timing/payload/failure-rate composability).
5. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple developers: complete Foundational together first (it blocks everything); then
Developer A takes User Story 1 while Developer B takes User Story 2; User Story 3 starts once
User Story 2's files exist, since it extends them.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- `resolveScenarioOutcome` is deliberately rewritten (not merely extended) between US2 (T009) and
  US3 (T015) — its US2 shape (`TestScenario, number|undefined -> StatusCodeDemo`) is fully correct
  and independently testable for everything US2's own acceptance scenarios require; US3 changes its
  signature and return type to add the failure-roll behavior, exactly as spec.md frames US3 as
  building on US2 rather than being fully independent of it.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies
  that would break User Story 1's or User Story 2's ability to be demoed on their own.
