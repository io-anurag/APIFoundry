# Phase 1 Data Model: Error Simulation & Generic Scenario Endpoint

This feature introduces **no mutable state**. Every "entity" below is either a static, read-only
catalog (a plain object literal, not a store) or a value computed fresh on each request from
existing catalogs/config plus, for four scenarios, a single draw from the already-existing shared
seeded PRNG. Nothing here needs a `reset()`, and `tests/helpers/resetStores.ts` needs no change.

## TestScenario (static enum)

```ts
export const TEST_SCENARIOS = [
  "success", "validation-error", "unauthorized", "forbidden", "not-found", "conflict",
  "rate-limit", "server-error", "service-unavailable", "timeout", "delayed", "large-response",
] as const;
export type TestScenario = (typeof TEST_SCENARIOS)[number];
```

Twelve values total, exactly as enumerated by CLAUDE.md #26 and spec.md FR-004. Defaults to
`"success"` when `scenario` is omitted from `GET /api/v1/test` (FR-004).

## SCENARIO_FIXED_STATUS (static lookup, single source of truth for FR-005)

```ts
export const SCENARIO_FIXED_STATUS: Partial<Record<TestScenario, number>> = {
  "validation-error": 400,
  unauthorized: 401,
  forbidden: 403,
  "not-found": 404,
  conflict: 409,
  "rate-limit": 429,
  "server-error": 500,
  "service-unavailable": 503,
  timeout: 408,
};
```

Nine of the twelve scenarios have an entry here; `success`, `delayed`, and `large-response` do not
(they have no fixed error status of their own — research.md Decision 7). Every value above is one
of Spec 004's already-documented `STATUS_CODE_DEMOS` codes; this table only says *which* code each
scenario name maps to — the status text, error code, and any extra headers (e.g. `429`'s
`Retry-After`) still come from `getStatusCodeDemo(code)` itself (research.md Decision 1), never
re-authored here.

## FAILURE_REPRESENTING_SCENARIOS (static subset)

```ts
export const FAILURE_REPRESENTING_SCENARIOS: readonly TestScenario[] = [
  "server-error", "service-unavailable", "rate-limit", "timeout",
];
```

The only scenarios `failureRate` applies to (FR-011); the remaining eight (`success`,
`validation-error`, `unauthorized`, `forbidden`, `not-found`, `conflict`, `delayed`,
`large-response`) ignore `failureRate` entirely and always produce their fixed, deterministic
outcome (FR-013).

## ERROR_ENDPOINT_SCENARIOS (static lookup, `/errors/*` path segment -> scenario name)

```ts
export const ERROR_ENDPOINT_SCENARIOS: Record<string, TestScenario> = {
  validation: "validation-error",
  "not-found": "not-found",
  conflict: "conflict",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  "rate-limit": "rate-limit",
  "server-error": "server-error",
  "service-unavailable": "service-unavailable",
  timeout: "timeout",
};
```

Its keys are exactly the nine `/errors/*` route path segments (FR-001); every value indexes back
into `SCENARIO_FIXED_STATUS` (Decision 2), so a dedicated endpoint and its matching named scenario
are structurally guaranteed to render the same `STATUS_CODE_DEMOS` entry — they cannot drift apart
as long as both read through this table and `SCENARIO_FIXED_STATUS` rather than hard-coding a code
of their own.

## ScenarioOutcome (computed per request, not stored)

```ts
type ScenarioOutcome =
  | { kind: "demo"; demo: StatusCodeDemo }               // render via renderStatusCodeDemo (error, or the status escape hatch's success/noBody/redirect/error shape)
  | { kind: "success"; scenario: TestScenario }           // plain 200 body describing which scenario ran
  | { kind: "delayed"; delayMs: number; status: number }  // wait delayMs, then 200 (or overridden status) success body
  | { kind: "largeResponse"; status: number };            // "large" preset payload, 200 (or overridden status)
```

Produced fresh on every request by `testScenario.service.ts`; nothing here is persisted. For a
failure-representing scenario, the `kind` is decided by a single `rollScenarioFailure(failureRate)`
draw (`kind: "demo"` on failure, `kind: "success"` otherwise); for the five other named
non-`delayed`/`large-response` scenarios it is always `kind: "demo"`; for `delayed`/`large-response`
it is always their own `kind`, with `status` defaulting to `200` unless overridden (research.md
Decision 7).

## StatusOverride (request-scoped value, not stored)

The optional `?status=` query parameter, validated by `parseOptionalStatusCodeParam` (an additive
companion to Spec 004's `parseStatusCodeParam`) against the same 24-code documented set used by
`GET /api/v1/status/{code}`. Reconciled against the resolved scenario's `SCENARIO_FIXED_STATUS`
entry (if any) per the Clarifications session's exact conflict rule:

| Scenario has a fixed status? | `status` given? | Result |
|---|---|---|
| No (`success`, `delayed`, `large-response`) | No | No override; scenario's own default (`200`) applies |
| No | Yes | Override applied — see `ScenarioOutcome` note above for `delayed`/`large-response`; for `success` (or `scenario` omitted), renders `getStatusCodeDemo(status)` via `renderStatusCodeDemo` (full success/noBody/redirect/error support) |
| Yes | No | Scenario's own fixed status/demo applies |
| Yes, and `status` equals it | Yes | Accepted as redundant; behaves exactly as `scenario` alone |
| Yes, and `status` differs | Yes | Rejected: `400 VALIDATION_ERROR` (FR-008) |

## SimulatedFailureRate (request-scoped value, reused concept from Spec 008)

Optional `?failureRate=` query parameter, parsed by the existing `parseFailureRateParam(raw,
fallback)` (Spec 008, unchanged) with `fallback = 1` for this endpoint (research.md Decision 6) —
deliberately different from `/flaky`'s `config.failureRate`-based fallback, so an omitted
`failureRate` means "always fail," matching the scenario's dedicated `/errors/*` counterpart
exactly. Applies only to `FAILURE_REPRESENTING_SCENARIOS` (FR-011/FR-013). The failure/success
decision itself is a single draw from the shared seeded PRNG (`nextRandom`), not
`rollFlakyOutcome` (research.md Decision 5) — reproducible across runs via the existing
`resetSeededRandom()` call already wired into `tests/helpers/resetStores.ts`.

## SimulatedDelay (request-scoped value, reused concept from Spec 007)

Optional `?delay=` query parameter (milliseconds), parsed by the existing `parseDelayMsParam(raw,
config.maxDelayMs)` (Spec 007, unchanged) — only meaningful for `scenario=delayed`, where it
determines how long the handler waits (via `setTimeout`, mirroring `delay.controller.ts`'s existing
non-`async` pattern) before responding.

## LargeResponsePayload (request-scoped value, reused concept from Spec 007)

The `scenario=large-response` body reuses `PAYLOAD_SIZE_PRESET_BYTES.large` (`1_048_576` bytes) and
`generatePayload(targetBytes)` from Spec 007's `payload.service.ts` verbatim, per the
Clarifications session — no independent size definition is introduced.

## Validation rules (from Functional Requirements)

- `GET /errors/*` (all nine): no query parameters, no body — always renders the fixed
  `STATUS_CODE_DEMOS` entry for that route's `ERROR_ENDPOINT_SCENARIOS` mapping, regardless of any
  header/body/credential supplied (FR-001, FR-002, FR-003).
- `GET /api/v1/test`:
  - `scenario` — optional; when present, must be one of `TEST_SCENARIOS` → else `400
    VALIDATION_ERROR` listing the supported names (FR-006); omitted → defaults to `"success"`
    (FR-004).
  - `status` — optional; when present, must be one of the 24 status-code-playground codes → else
    `400 VALIDATION_ERROR` (reusing `parseStatusCodeParam`'s existing rules); further rejected with
    `400 VALIDATION_ERROR` if it conflicts with the resolved scenario's fixed status (FR-008, table
    above).
  - `delay` — optional, only meaningful for `scenario=delayed`; must be a non-negative integer not
    exceeding `config.maxDelayMs` → else `400 VALIDATION_ERROR` (FR-009, reusing
    `parseDelayMsParam`).
  - `failureRate` — optional, only meaningful for `FAILURE_REPRESENTING_SCENARIOS`; must be a
    decimal in `[0, 1]` → else `400 VALIDATION_ERROR` (FR-012, reusing `parseFailureRateParam`);
    ignored (never even parsed against a stricter rule) for every other scenario (FR-013).
