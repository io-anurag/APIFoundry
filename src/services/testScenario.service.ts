import { nextRandom } from "../utils/seededRandom";
import { getStatusCodeDemo } from "./statusCode.service";
import type { StatusCodeDemo } from "../models/statusCodeDemo";
import {
  SCENARIO_FIXED_STATUS,
  FAILURE_REPRESENTING_SCENARIOS,
  type TestScenario,
} from "../data/testScenarios.catalog";

export type ScenarioOutcome = { kind: "demo"; demo: StatusCodeDemo } | { kind: "plainSuccess" };

/**
 * Decides whether a single failure-representing scenario call fails, at approximately
 * `failureRate`. A single draw against the shared seeded PRNG (`nextRandom`) — not
 * `rollFlakyOutcome` (Spec 008), whose status-pool-selection logic doesn't apply since every
 * scenario here already has exactly one fixed status to fail with (research.md Decision 5).
 *
 * @param failureRate - Probability of failure, in `[0, 1]`.
 * @param draw - Source of randomness; defaults to the shared seeded PRNG (injectable for tests).
 * @returns Whether this call should render the scenario's failure outcome.
 */
export function rollScenarioFailure(failureRate: number, draw: () => number = nextRandom): boolean {
  return draw() < failureRate;
}

/**
 * Resolves which outcome `GET /api/v1/test` should render for a given scenario/status/failureRate
 * combination: a named scenario's own fixed status always wins unless it's failure-representing
 * and the failure roll says "succeed" (research.md Decision 1); otherwise the caller's `status`
 * override applies; otherwise the plain `200` success demo.
 *
 * For a scenario that is **not** failure-representing (one of the five deterministic-error
 * names), `failed` short-circuits to `true` without calling `rollScenarioFailure`/`draw()` at
 * all, so the shared PRNG's sequence is never consumed for those (mirrors `rollFlakyOutcome`'s
 * disabled-mode no-draw pattern, FR-013).
 *
 * At this stage `scenario` is either one of the nine fixed-status names or `"success"` — the
 * controller special-cases `"delayed"`/`"large-response"` before ever calling this function.
 *
 * @param scenario - The resolved scenario.
 * @param statusOverride - The resolved, already-conflict-checked `status` override, if any.
 * @param failureRate - The resolved failure rate (only meaningful for a failure-representing scenario).
 * @returns The outcome to render.
 */
export function resolveScenarioOutcome(
  scenario: TestScenario,
  statusOverride: number | undefined,
  failureRate: number
): ScenarioOutcome {
  const fixedStatus = SCENARIO_FIXED_STATUS[scenario];
  if (fixedStatus !== undefined) {
    const isFailureRepresenting = (FAILURE_REPRESENTING_SCENARIOS as readonly string[]).includes(scenario);
    const failed = !isFailureRepresenting || rollScenarioFailure(failureRate);
    if (!failed) {
      return { kind: "plainSuccess" };
    }
    return { kind: "demo", demo: getStatusCodeDemo(fixedStatus) };
  }

  return { kind: "demo", demo: getStatusCodeDemo(statusOverride ?? 200) };
}
