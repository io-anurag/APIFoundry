/**
 * Health-check routes mounted outside the versioned API prefix: `/health`, `/health/live`, and
 * `/health/ready`. None of these require authentication.
 */
import { Router } from "express";
import { getHealth, getLiveness, getReadiness } from "../controllers/health.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const healthRouter = Router();

healthRouter.get("/health", getHealth);
healthRouter.all("/health", methodNotAllowedHandler);

healthRouter.get("/health/live", getLiveness);
healthRouter.all("/health/live", methodNotAllowedHandler);

healthRouter.get("/health/ready", getReadiness);
healthRouter.all("/health/ready", methodNotAllowedHandler);
