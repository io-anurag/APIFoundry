/**
 * Single source of truth mapping every named test scenario to its fixed HTTP status (when it has
 * one), shared by both `/errors/*` (src/routes/errors.routes.ts) and `GET /api/v1/test`
 * (src/routes/testScenario.routes.ts) so the two surfaces cannot drift apart (spec.md FR-005).
 */
export const TEST_SCENARIOS = [
  "success",
  "validation-error",
  "unauthorized",
  "forbidden",
  "not-found",
  "conflict",
  "rate-limit",
  "server-error",
  "service-unavailable",
  "timeout",
  "delayed",
  "large-response",
] as const;

export type TestScenario = (typeof TEST_SCENARIOS)[number];

/**
 * Every value here is one of Spec 004's already-documented `STATUS_CODE_DEMOS` codes — this table
 * only says which code each scenario name maps to; the status text, error code, and any extra
 * headers still come from `getStatusCodeDemo(code)` itself. `success`, `delayed`, and
 * `large-response` have no entry: they have no fixed error status of their own.
 */
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

/** The only scenarios `failureRate` applies to; every other scenario ignores it entirely. */
export const FAILURE_REPRESENTING_SCENARIOS: readonly TestScenario[] = [
  "server-error",
  "service-unavailable",
  "rate-limit",
  "timeout",
];

/**
 * `/errors/*` path segment -> scenario name. Identical for eight of the nine, except
 * `validation` -> `validation-error` (CLAUDE.md spells the dedicated endpoint and the scenario
 * query value differently on purpose).
 */
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
