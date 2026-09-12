# Implementation Plan: Error Simulation & Generic Scenario Endpoint

**Branch**: `010-error-simulation-scenario-endpoint` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-error-simulation-scenario-endpoint/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver nine deterministic, parameter-free `/errors/*` endpoints (one per documented failure mode)
and one configurable `GET /api/v1/test` endpoint that composes the same outcomes behind a
`scenario` query parameter, plus an optional `status` escape hatch, an optional bounded `delay`,
and an optional `failureRate` for the four scenarios that represent an unreliable dependency
(`server-error`, `service-unavailable`, `rate-limit`, `timeout`). Technical approach: every fixed
status/error-code outcome (both the nine `/errors/*` routes and the nine matching named scenarios)
is a lookup into Spec 004's existing `STATUS_CODE_DEMOS` catalog via `getStatusCodeDemo(code)` — no
new error-code mapping is invented, only a small new table associating each scenario/endpoint name
with the already-defined code. The `status` escape hatch and the `success`/`delayed`/`large-response`
scenarios reuse Spec 004's full success/noBody/redirect/error rendering switch, extracted out of
`statusCode.controller.ts` into a single shared function so it isn't duplicated. `delay` reuses
Spec 007's `parseDelayMsParam`/`config.maxDelayMs` verbatim; `large-response` reuses Spec 007's
exact `large` payload preset (`PAYLOAD_SIZE_PRESET_BYTES.large` + `generatePayload`) per the
Clarifications session; `failureRate` reuses Spec 008's shared seeded PRNG (`nextRandom`) with a
single `roll < failureRate` check — not `rollFlakyOutcome`, whose status-pool-selection logic
doesn't apply since each scenario's failure status is already fixed. This feature introduces no new
mutable state and no new environment variable. See [research.md](research.md) for full rationale on
every non-obvious decision.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-009

**Primary Dependencies**: Express 4.x, `zod` (already used for other request validation, not
required here — this feature's validation is small enough to follow the existing hand-rolled
`utils/*Param.ts` pattern, same as `delayMsParam.ts`/`statusCodeParam.ts`/`payloadPresetParam.ts`)
— no new npm dependency.

**Storage**: In-memory only, consistent with the whole project. This feature adds **no** new store
— every outcome is either a pure lookup into an existing or new read-only catalog, or a stateless
PRNG draw from the already-existing shared seeded random source.

**Testing**: Vitest + Supertest — unchanged from Specs 001-009.

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a direct
target for k6/Postman/contract-test tooling — this spec is explicitly the primary k6-facing hook
(CLAUDE.md #26).

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged.

**Performance Goals**: Every endpoint's own work (catalog lookup, one or two PRNG draws, string
comparisons) is O(1) except the two deliberately-bounded behaviors this spec exists to demonstrate:
`scenario=delayed` (bounded by `MAX_DELAY_MS`) and `scenario=large-response` (bounded by the fixed
"large" payload preset, itself bounded by `MAX_PAYLOAD_SIZE`). No endpoint performs an external
call or unbounded allocation.

**Constraints**: `/errors/*` and the matching named scenarios must stay byte-for-byte consistent
with each other (FR-005) — enforced structurally by having both read the same
`SCENARIO_FIXED_STATUS` table and the same `STATUS_CODE_DEMOS` catalog, so they cannot drift.
`scenario`/`status` conflict detection must follow the Clarifications session's exact rule (a
`status` equal to the named scenario's own fixed code is redundant-but-allowed; any other value for
a scenario with a fixed code is rejected; `success`/`delayed`/`large-response` never conflict).
`failureRate`'s default when omitted must be `1` (always fail) for this endpoint specifically —
deliberately different from `/flaky`'s `config.failureRate`-based default — so a bare
`scenario=server-error` matches `/errors/server-error` exactly (spec.md Assumptions, as amended).

**Scale/Scope**: This spec only — 9 new top-level routes plus 1 new versioned route, across 2
router files, sharing one new read-only scenario catalog and one small, additively-extended
rendering helper in Spec 004's `statusCode.service.ts`. Depends on Specs 004 (status-code catalog +
rendering), 007 (`delay`/`large` payload reuse), and 008 (shared seeded PRNG) per the roadmap; no
other prior spec's file is touched. Independently buildable/testable — no dependency on Spec 011
(admin/reset), since this feature has no mutable state for it to reset.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds the two remaining endpoint families CLAUDE.md calls for (#25 error simulation, #26 the generic k6 scenario hook) — pure surface expansion; nothing narrowed. |
| II. Determinism & Reproducibility | PASS | Every `/errors/*` route and every scenario without `failureRate` is 100% deterministic by construction (a fixed catalog lookup, no randomness consulted at all). The one place randomness enters (`failureRate` on the four failure-representing scenarios) reuses the same shared, seeded, reset-on-`resetStores()` PRNG Spec 008 already established — no new non-deterministic surface. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every rejection path (unrecognized `scenario`, conflicting `status`, invalid `delay`/`failureRate`) resolves to a structured `400 VALIDATION_ERROR` via the existing `HttpError`/`errorHandler` machinery; nothing throws unhandled. All success and error bodies use the existing envelopes; every response carries `X-Request-ID`. |
| IV. Secret & Credential Hygiene | PASS | No new secret-bearing configuration. `/errors/unauthorized`/`/errors/forbidden` and their scenario equivalents never inspect or echo any credential supplied — they are unconditional simulations by design (spec.md Assumptions). |
| V. Bounded Resource Usage Under Load | PASS | Every endpoint's own work is O(1) apart from the two intentionally-bounded behaviors (`delay`, `large-response`), each bounded by the same configured maximum every other spec already uses (`MAX_DELAY_MS`, the fixed `large` preset under `MAX_PAYLOAD_SIZE`). No endpoint makes an external call. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New code follows the existing `routes/controllers/services/models/data/utils` split. `/errors/*` mounts top-level (mirroring Spec 007/008's bare-path utilities); `GET /api/v1/test` mounts under the existing versioned `apiRouter` (mirroring `statusCodeRouter`). |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly 10 new paths (9 `/errors/*` plus `/api/v1/test`) from `contracts/error-simulation.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/010-error-simulation-scenario-endpoint/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── data/
│   └── testScenarios.catalog.ts   # NEW: TEST_SCENARIOS, SCENARIO_FIXED_STATUS, FAILURE_REPRESENTING_SCENARIOS, ERROR_ENDPOINT_SCENARIOS (path-segment -> scenario name alias for the one name that differs: "validation" -> "validation-error")
├── models/
│   └── testScenarioRequest.ts     # NEW: parseScenarioParam, resolveStatusOverride (scenario/status conflict check), TestScenario type re-export
├── utils/
│   └── statusCodeParam.ts         # existing (Spec 004); gains parseOptionalStatusCodeParam(raw) for the query-parameter (vs. required path-parameter) use case
├── services/
│   ├── statusCode.service.ts      # existing (Spec 004); gains renderStatusCodeDemo(demo, requestId, res), extracted from statusCode.controller.ts's switch so both surfaces share it
│   └── testScenario.service.ts    # NEW: resolveScenarioOutcome(scenario, statusOverride, failureRate) -> what to render; rollScenarioFailure(failureRate) using the shared seeded PRNG
├── controllers/
│   ├── statusCode.controller.ts   # existing (Spec 004); switch body replaced by a call to renderStatusCodeDemo (no behavior change)
│   ├── errors.controller.ts       # NEW: one handler per /errors/* route (thin: look up the scenario's fixed demo, render via renderStatusCodeDemo)
│   └── testScenario.controller.ts # NEW: GET /api/v1/test handler; validates scenario/status/delay/failureRate, then dispatches (immediate response, or setTimeout-wrapped for scenario=delayed, mirroring delay.controller.ts's non-async pattern)
└── routes/
    ├── errors.routes.ts           # NEW: top-level router, GET /errors/{validation|not-found|conflict|unauthorized|forbidden|rate-limit|server-error|service-unavailable|timeout}
    └── testScenario.routes.ts     # NEW: GET /api/v1/test, mounted inside the existing versioned apiRouter

tests/
├── errorScenarios.test.ts         # NEW
├── testScenario.test.ts           # NEW
└── helpers/resetStores.ts         # existing; no change needed (this feature adds no new store — `resetSeededRandom()` is already called for every test, which is the only shared state this feature reads)

openapi.yaml                       # existing; gains the 10 paths/schemas from contracts/error-simulation.openapi.yaml
```

**Structure Decision**: Extends the existing Specs 001-009 single-backend-project layout with no
new top-level directory. Two prior-spec files gain a small, additive, behavior-preserving change
(`statusCode.service.ts` gains one exported function; `statusCode.controller.ts`'s existing switch
is replaced by a call to it) — no other file from any earlier spec is modified, preserving the
roadmap's expectation that this spec is buildable once Specs 005/006/007/008 exist without
disturbing them.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS. `data-model.md` confirms the
nine `/errors/*` outcomes and the nine matching scenario outcomes are structurally guaranteed to
match (both resolve through the same `SCENARIO_FIXED_STATUS` table into the same
`STATUS_CODE_DEMOS` entry), so FR-005 cannot silently drift as future specs touch either surface.
`contracts/error-simulation.openapi.yaml` documents exactly the 10 operations this spec implements,
reusing the root document's existing `Error`, `ValidationError`, `NotFound`, `Unauthorized`,
`Forbidden`, `RateLimited`, and `Conflict` components rather than redefining them, and adding only
the three genuinely new named responses this spec needs (`ServerError`, `ServiceUnavailable`,
`RequestTimeout`) for future specs to reuse in turn. No `allOf`/`oneOf`/`anyOf` combinators are used
anywhere in the contract, consistent with every prior spec's OpenAPI fragment. The quickstart's
walkthroughs directly exercise Principles II, III, and V (the `failureRate` sequence is shown to
reproduce after a reset; no endpoint's own work scales with caller input beyond the two bounded,
intentional behaviors). No new violations introduced during design; Complexity Tracking remains
empty.
