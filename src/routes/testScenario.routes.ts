/**
 * `GET /api/v1/test`: the primary k6-facing generic scenario endpoint (CLAUDE.md #26). No
 * authentication required.
 */
import { Router } from "express";
import * as testScenarioController from "../controllers/testScenario.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const testScenarioRouter = Router({ strict: true });

testScenarioRouter.get("/test", testScenarioController.getTestScenario);
testScenarioRouter.all("/test", methodNotAllowedHandler);
