import { Router, type NextFunction, type Request, type Response } from "express";
import * as roleController from "../controllers/role.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";
import { parseRoleParam } from "../utils/roleParam";

export const roleRouter = Router({ strict: true });

// Validates :role (400 on failure) before authentication is even checked — a malformed path is
// rejected regardless of auth state, never a false 401/403/404 (FR-008).
function validateRoleParam(req: Request, _res: Response, next: NextFunction): void {
  parseRoleParam(req.params.role);
  next();
}

/** The required role is the path value itself (FR-008), already validated by validateRoleParam. */
function requireMatchingRole(req: Request, res: Response, next: NextFunction): void {
  requireRole(parseRoleParam(req.params.role))(req, res, next);
}

roleRouter.get("/role/:role", validateRoleParam, authenticate, requireMatchingRole, roleController.getRoleDemo);
roleRouter.all("/role/:role", methodNotAllowedHandler);
