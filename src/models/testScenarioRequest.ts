import { HttpError } from "../utils/httpError";
import { parseOptionalStatusCodeParam } from "../utils/statusCodeParam";
import { parseFailureRateParam } from "./flakyRequests";
import {
  TEST_SCENARIOS,
  SCENARIO_FIXED_STATUS,
  FAILURE_REPRESENTING_SCENARIOS,
  type TestScenario,
} from "../data/testScenarios.catalog";

/**
 * Parses and validates the `scenario` query parameter for `GET /api/v1/test`.
 *
 * @param raw - The raw query value (`undefined` when omitted).
 * @returns The validated scenario, defaulting to `"success"` when omitted (FR-004).
 * @throws HttpError 400 VALIDATION_ERROR if `raw` is present but not one of TEST_SCENARIOS (FR-006).
 */
export function parseScenarioParam(raw: unknown): TestScenario {
  if (raw === undefined) return "success";

  if (typeof raw !== "string" || !(TEST_SCENARIOS as readonly string[]).includes(raw)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `Invalid scenario '${String(raw)}': must be one of ${TEST_SCENARIOS.join(", ")}.`,
      { field: "scenario", value: raw, supportedScenarios: TEST_SCENARIOS }
    );
  }

  return raw as TestScenario;
}

/**
 * Parses the optional `status` query parameter and reconciles it against the resolved scenario's
 * own fixed status (if any), per the Clarifications session's exact conflict rule: a `status`
 * equal to the scenario's own fixed code is accepted as redundant; any other value for a scenario
 * with a fixed code is rejected; a scenario with no fixed code (`success`, `delayed`,
 * `large-response`) never conflicts (FR-007/FR-008).
 *
 * @param rawStatus - The raw `?status=` query value.
 * @param scenario - The already-resolved scenario for this request.
 * @returns The validated status override, or `undefined` if omitted.
 */
export function resolveStatusOverride(rawStatus: unknown, scenario: TestScenario): number | undefined {
  const status = parseOptionalStatusCodeParam(rawStatus);
  if (status === undefined) return undefined;

  const fixed = SCENARIO_FIXED_STATUS[scenario];
  if (fixed !== undefined && status !== fixed) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `status ${status} conflicts with scenario '${scenario}' (expected ${fixed}).`,
      { field: "status", value: status, scenario, expected: fixed }
    );
  }

  return status;
}

/**
 * Parses the optional `failureRate` query parameter, applicable only to
 * FAILURE_REPRESENTING_SCENARIOS. For any other scenario, `failureRate` is ignored entirely
 * (never parsed/validated, so a garbage value never causes a 400) and this returns `1` as a
 * no-op default — the caller (testScenario.service.ts) only ever consults this value for a
 * failure-representing scenario in the first place (FR-013).
 *
 * @param raw - The raw `?failureRate=` query value.
 * @param scenario - The already-resolved scenario for this request.
 * @returns The validated failure rate; defaults to `1` (always fail) when omitted, deliberately
 *   different from `/flaky`'s `config.failureRate`-based default, so a bare scenario matches its
 *   dedicated `/errors/*` counterpart exactly (research.md Decision 6).
 */
export function resolveFailureRate(raw: unknown, scenario: TestScenario): number {
  if (!(FAILURE_REPRESENTING_SCENARIOS as readonly string[]).includes(scenario)) return 1;
  return parseFailureRateParam(raw, 1);
}
