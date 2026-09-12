/**
 * Rate-limit demo route: `GET /rate-limit` tracks a per-caller request count against a
 * configurable threshold/window, returning `429` + `Retry-After` past it. No authentication
 * required.
 */
import { Router } from "express";
import * as rateLimitController from "../controllers/rateLimit.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const rateLimitRouter = Router({ strict: true });

rateLimitRouter.get("/rate-limit", rateLimitController.getRateLimit);
rateLimitRouter.all("/rate-limit", methodNotAllowedHandler);
