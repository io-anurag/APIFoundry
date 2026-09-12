/**
 * Flaky-failure demo route: `GET /flaky?failureRate=` fails at approximately the requested rate,
 * reproducibly across runs, disableable via `FLAKY_ENABLED`. No authentication required.
 */
import { Router } from "express";
import * as flakyController from "../controllers/flaky.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const flakyRouter = Router({ strict: true });

flakyRouter.get("/flaky", flakyController.getFlaky);
flakyRouter.all("/flaky", methodNotAllowedHandler);
