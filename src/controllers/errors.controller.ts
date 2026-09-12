import type { Request, Response } from "express";
import { getStatusCodeDemo, renderStatusCodeDemo } from "../services/statusCode.service";
import { requestIdOf } from "../middleware/requestId";
import { ERROR_ENDPOINT_SCENARIOS, SCENARIO_FIXED_STATUS } from "../data/testScenarios.catalog";

/**
 * Builds the handler for one `/errors/:pathSegment` route. The demo is resolved once at
 * module-load time (a static catalog lookup, not per-request work) since every `/errors/*`
 * outcome is fixed and parameter-free — it always renders the same StatusCodeDemo regardless of
 * any header, body, or credential the caller supplies (spec.md FR-001/FR-003).
 *
 * @param pathSegment - A key of ERROR_ENDPOINT_SCENARIOS (e.g. "not-found", "validation").
 * @returns An Express handler that renders that scenario's fixed demo.
 */
export function makeErrorEndpointHandler(pathSegment: keyof typeof ERROR_ENDPOINT_SCENARIOS) {
  const scenario = ERROR_ENDPOINT_SCENARIOS[pathSegment];
  const demo = getStatusCodeDemo(SCENARIO_FIXED_STATUS[scenario] as number);

  return function handleErrorEndpoint(req: Request, res: Response): void {
    renderStatusCodeDemo(demo, requestIdOf(req), res);
  };
}
