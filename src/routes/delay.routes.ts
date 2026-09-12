/**
 * Delay routes: `GET /delay/:ms` and `GET /delay?ms=` both simulate a configurable response
 * delay, bounded by `config.maxDelayMs`. No authentication required.
 */
import { Router } from "express";
import * as delayController from "../controllers/delay.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const delayRouter = Router({ strict: true });

delayRouter.get("/delay/:ms", delayController.getDelay);
delayRouter.all("/delay/:ms", methodNotAllowedHandler);

delayRouter.get("/delay", delayController.getDelay);
delayRouter.all("/delay", methodNotAllowedHandler);
