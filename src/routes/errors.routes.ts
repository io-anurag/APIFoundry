/**
 * `/errors/*`: nine dedicated, deterministic error-simulation endpoints (CLAUDE.md #25). No
 * authentication required; every route is generated from ERROR_ENDPOINT_SCENARIOS so no path
 * segment can drift out of sync with the shared scenario catalog.
 */
import { Router } from "express";
import { makeErrorEndpointHandler } from "../controllers/errors.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";
import { ERROR_ENDPOINT_SCENARIOS } from "../data/testScenarios.catalog";

export const errorsRouter = Router({ strict: true });

for (const pathSegment of Object.keys(ERROR_ENDPOINT_SCENARIOS)) {
  const path = `/errors/${pathSegment}`;
  errorsRouter.get(path, makeErrorEndpointHandler(pathSegment));
  errorsRouter.all(path, methodNotAllowedHandler);
}
