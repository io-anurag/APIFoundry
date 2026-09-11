import { Router } from "express";
import * as protectedController from "../controllers/protected.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const protectedRouter = Router({ strict: true });

// Fixed to "admin" for the clearest possible 401-vs-403 demonstration (research.md Decision 8).
protectedRouter.get("/protected", authenticate, requireRole("admin"), protectedController.getProtected);
protectedRouter.all("/protected", methodNotAllowedHandler);
