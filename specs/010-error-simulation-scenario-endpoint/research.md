# Phase 0 Research: Error Simulation & Generic Scenario Endpoint

All items below were resolvable from CLAUDE.md, the constitution, the existing Spec 001-009
codebase (`STATUS_CODE_DEMOS`, `parseDelayMsParam`, `payload.service.ts`, `seededRandom.ts`), and
the three decisions already recorded in spec.md's Clarifications session. No `NEEDS CLARIFICATION`
markers remain in the Technical Context.

## Decision 1: Both `/errors/*` and the matching named scenarios are lookups into Spec 004's existing `STATUS_CODE_DEMOS`

**Decision**: A new `src/data/testScenarios.catalog.ts` defines `SCENARIO_FIXED_STATUS`, a table
mapping each of the nine outcome-bearing scenario names (`validation-error`, `unauthorized`,
`forbidden`, `not-found`, `conflict`, `rate-limit`, `server-error`, `service-unavailable`,
`timeout`) to the exact status code Spec 004 already assigned that error shape (400, 401, 403, 404,
409, 429, 500, 503, 408 respectively). Both `errors.controller.ts` and
`testScenario.controller.ts` call `getStatusCodeDemo(SCENARIO_FIXED_STATUS[name])` — never a second,
independent copy of the status/error-code/message text.

**Rationale**: FR-005 requires the two surfaces to always agree; the only way to make that
structurally guaranteed (rather than "agree today, drift tomorrow") is for both to read the exact
same table and the exact same underlying catalog entry, not two hand-typed copies of "404 means
RESOURCE_NOT_FOUND." `STATUS_CODE_DEMOS` already carries the right message text, error code, and
any extra headers (e.g. `429`'s `Retry-After: "60"`) for every one of these nine codes, so no new
message/error-code text needs to be authored here at all.

**Alternatives considered**: hand-writing each `/errors/*` handler with its own inline
status/message/error-code (rejected — duplicates Spec 004's catalog and risks the two surfaces
silently disagreeing after a future edit to either); a runtime assertion that cross-checks the two
surfaces in a test rather than sharing a table (rejected — a shared source of truth prevents the
class of bug entirely, rather than merely detecting it after the fact).

## Decision 2: `/errors/validation` aliases to the `validation-error` scenario name via a small lookup table

**Decision**: `testScenarios.catalog.ts` also exports `ERROR_ENDPOINT_SCENARIOS`, a
`Record<string, TestScenario>` mapping each `/errors/*` path segment to its scenario name — identical
for eight of the nine (`not-found` -> `not-found`, `conflict` -> `conflict`, etc.), except
`validation` -> `validation-error`. `errors.routes.ts` mounts one route per key of this table, and
`errors.controller.ts`'s single handler factory looks up `ERROR_ENDPOINT_SCENARIOS[pathSegment]`
before delegating to the same `SCENARIO_FIXED_STATUS` lookup as Decision 1.

**Rationale**: CLAUDE.md item #25 spells the dedicated endpoint `validation` while item #26 spells
the query-parameter value `validation-error` — a deliberate difference in the source specification,
not a typo to silently normalize away. A one-entry-different alias table keeps both spellings exact
without forking the underlying status/error-code logic.

**Alternatives considered**: renaming one to match the other (rejected — CLAUDE.md's two catalogs
are both explicit, literal path/parameter spellings the OpenAPI document and any external test
suite already expects); a `switch` statement duplicating the nine-way mapping twice, once per path
naming convention (rejected — the one-line alias table is strictly simpler and keeps Decision 1's
single-source-of-truth property intact).

## Decision 3: `status` escape hatch and the `success`/`delayed`/`large-response` scenarios reuse Spec 004's full rendering switch, extracted into `statusCode.service.ts`

**Decision**: `statusCode.controller.ts`'s existing `switch (demo.shape)` block (success / noBody /
redirect / error) is extracted verbatim into a new exported `renderStatusCodeDemo(demo, requestId,
res)` in `statusCode.service.ts`. `statusCode.controller.ts` is updated to call it (no behavior
change — confirmed by its existing test suite continuing to pass unmodified). `testScenario.controller.ts`
calls the same function whenever `status` resolves to a code not already covered by a named
scenario's own fixed error rendering (i.e., the `success`-or-absent-`scenario` case from FR-007).

**Rationale**: FR-007 requires `GET /api/v1/test?status=...` to support the **full** documented set
(including `204`/`304`/no-body and `301`/`302` redirects, per the Clarifications session) — exactly
the same four-way shape distinction `/api/v1/status/{code}` already implements correctly. Extracting
it once avoids a second, inevitably-drifting copy of that branching logic for what is genuinely the
same presentation concern reused by a second endpoint, not a new concern of this spec's own.

**Alternatives considered**: duplicating the four-way switch inline inside
`testScenario.controller.ts` (rejected — ~20 lines of branching logic that must stay in lockstep
with Spec 004's original is exactly the kind of real duplication the project's own conventions
(and Spec 008's precedent of reusing `createKeyedStore`/services rather than re-deriving them)
argue against); restricting `status` to only error-shaped codes to avoid needing the redirect/noBody
branches at all (rejected in the Clarifications session in favor of full support).

## Decision 4: `parseOptionalStatusCodeParam` is an additive companion to Spec 004's `parseStatusCodeParam`

**Decision**: `utils/statusCodeParam.ts` gains
`parseOptionalStatusCodeParam(raw: unknown): number | undefined`, returning `undefined` when `raw`
is `undefined`, rejecting any non-string value with the same `400 VALIDATION_ERROR` shape, and
otherwise delegating to the existing `parseStatusCodeParam(raw)` for the actual strict-integer /
range / documented-code validation. `parseStatusCodeParam` itself is unchanged.

**Rationale**: The existing function assumes a required path parameter (`:code`, always a string
once Express routes to the handler). The new `?status=` query parameter is optional and can arrive
as `undefined`, a string, or (per Express's query-parsing rules) an array — the wrapper handles
exactly that difference while reusing 100% of the existing validation rules, so `?status=` and
`/api/v1/status/{code}` can never disagree about which codes are valid.

**Alternatives considered**: re-implementing the strict-integer/range/documented-code checks a
second time inside `testScenarioRequest.ts` (rejected — pure duplication of Decision 1's same
"single source of truth" reasoning); making `raw` required and having the controller special-case
`undefined` before calling it (rejected — pushes a validation concern into the controller layer,
inconsistent with every other `utils/*Param.ts` file in this project owning its own parameter's
full validation, `undefined`-handling included).

## Decision 5: `failureRate` reuses the shared seeded PRNG directly (`nextRandom() < failureRate`), not `rollFlakyOutcome`

**Decision**: `testScenario.service.ts` exports a small `rollScenarioFailure(failureRate: number,
draw: () => number = nextRandom): boolean`, returning `draw() < failureRate`. It is called only for
the four failure-representing scenarios; a `true` result renders the scenario's fixed
`STATUS_CODE_DEMOS` entry (Decision 1), a `false` result renders a plain `200` success body.

**Rationale**: Spec 008's `rollFlakyOutcome` additionally *picks which* failure status to return
from a pool of four (`500`/`502`/`503`/`504`), because `/flaky` itself has no single fixed outcome.
Every scenario in this spec already has exactly one fixed status (Decision 1) — there is nothing to
pick from — so reusing `rollFlakyOutcome` would mean either ignoring half its return value or
threading a single-element "pool" through it for no benefit. A one-line boolean roll against the
same shared, seeded, reset-on-`resetStores()` PRNG (`nextRandom`) gets full reproducibility
(constitution Principle II) with less code than adapting a function built for a different shape of
problem.

**Alternatives considered**: reusing `rollFlakyOutcome(enabled=true, failureRate)` and discarding
its `status` field when present (rejected — its second PRNG draw, used only to index into the
four-status pool, would consume the shared PRNG's sequence for no purpose here, changing the
reproducible sequence every other spec's tests already depend on for unrelated reasons); a second,
independent PRNG instance just for this endpoint (rejected — two independently-seeded PRNGs
reset by the same `resetStores()` call is no more reproducible than one, and only adds a second
piece of state to keep in sync).

## Decision 6: `failureRate`'s default when omitted is a fixed `1` (always fail), not `config.failureRate`

**Decision**: `testScenarioRequest.ts` calls the existing `parseFailureRateParam(raw, fallback)`
(Spec 008, unchanged) with `fallback = 1` for this endpoint, rather than `config.failureRate` as
`/flaky` does.

**Rationale**: FR-005 requires a bare `scenario=server-error` (no `failureRate`) to return exactly
what `/errors/server-error` returns — always the failure. `config.failureRate` defaults to `0`
(mostly-succeeding), which would make the two surfaces disagree by default. A fixed default of `1`
for this endpoint specifically (confirmed by amending spec.md's Assumptions section during
planning) makes "no `failureRate` supplied" mean "fully deterministic, matching the dedicated
endpoint" — exactly what User Story 2 promises — while still letting a caller opt into a lower,
probabilistic rate exactly as User Story 3 describes.

**Alternatives considered**: reusing `config.failureRate` as originally (incorrectly) assumed in an
earlier draft of spec.md (rejected during planning — directly contradicts FR-005/Acceptance
Scenario 3, which requires scenario-endpoint parity with `/errors/*` by default); introducing a
second env var just for this endpoint's default (rejected — a fixed literal `1` needs no
configuration surface, and nothing in the spec calls for this default to be tunable).

## Decision 7: `status` combined with `delayed`/`large-response` overrides only the final status code, not the body shape

**Decision**: When `scenario` is `delayed` or `large-response` (neither has an entry in
`SCENARIO_FIXED_STATUS`) and an explicit `status` is also supplied, the endpoint still performs the
scenario's own behavior (waits `delay` ms, or generates the "large" payload) and still returns that
scenario's own body shape, but sends it with the caller-supplied `status` as the response code
instead of `200`. It does **not** switch to the general `status`-code-playground body shape
(`renderStatusCodeDemo`) for this combination.

**Rationale**: `delayed` and `large-response` are behavior-only scenarios (a wait, a body size) with
no error-shaped meaning of their own; per FR-008/Clarifications, `status` is always accepted
alongside them since they have no fixed code to conflict with, but the spec's User Story 3 never
describes them producing an error-envelope body — only a delayed or oversized *success* response.
Keeping their own body shape and only swapping the numeric status code is the simplest behavior
consistent with everything the spec explicitly requires, without inventing a new, unrequested body
shape for this one combination.

**Alternatives considered**: switching to `renderStatusCodeDemo(status)`'s shape whenever `status`
is present (rejected — would silently drop the delay/large-body behavior the caller explicitly
asked for via `scenario`, the opposite of "compose timing/payload/failure into a test step" that
User Story 3 promises); rejecting `status` combined with `delayed`/`large-response` outright
(rejected — explicitly contradicted by FR-008, which says these two scenarios "never conflict"
with `status`).

## Decision 8: Route mounting — `/errors/*` top-level; `GET /api/v1/test` under the versioned `apiRouter`

**Decision**: `errorsRouter` mounts top-level in `src/app.ts`, alongside `delayRouter`/
`rateLimitRouter`/`flakyRouter`/etc. `testScenarioRouter` mounts inside the existing `apiRouter`
(the same `Router()` that already carries `statusCodeRouter`, `protectedRouter`, etc.), so its full
path is `${config.apiPrefix}/test`.

**Rationale**: Matches CLAUDE.md's literal spelling exactly — `/errors/*` (no prefix, item #25) vs.
`/api/v1/test` (versioned, item #26) — and matches this project's established precedent (Specs
007/008 for bare-path testing utilities; Spec 004 for versioned demo endpoints).

**Alternatives considered**: mounting both under `/api/v1` for uniformity (rejected — contradicts
CLAUDE.md's explicit spelling for `/errors/*` and every prior spec's identical bare-path precedent
for the same category of generic testing utility).

## Decision 9: No new environment variables, no new store, no `resetStores.ts` change

**Decision**: This feature adds nothing to `env.schema.ts`, `config/index.ts`, or `.env.example`,
and nothing to `tests/helpers/resetStores.ts`.

**Rationale**: `MAX_DELAY_MS` and `MAX_PAYLOAD_SIZE` already exist and are reused unchanged
(Decisions covering `delay`/`large-response`); `failureRate`'s default is a fixed literal (Decision
6), needing no configuration; every outcome is either a stateless catalog lookup or a stateless
draw from the PRNG Spec 008 already registered with `resetStores()` — there is no new mutable state
for this feature to own or reset.

**Alternatives considered**: none — this is a direct consequence of Decisions 1-8, not an
independent design choice.
