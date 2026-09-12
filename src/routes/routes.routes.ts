/**
 * Route-discovery route: `GET /routes` (mounted under the versioned API prefix by app.ts),
 * returning every implemented route's method, path, description, and auth requirement. No
 * authentication is required, mirroring info.routes.ts.
 */
import { Router } from "express";
import { getRoutes } from "../controllers/routes.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const routesRouter = Router();

routesRouter.get("/routes", getRoutes);
routesRouter.all("/routes", methodNotAllowedHandler);
