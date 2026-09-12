/**
 * `GET /role/:role`: role-demo route. `:role` is validated (400 on a bad value) before authentication
 * is even checked, then the caller must be authenticated and hold the role named in the path — a
 * malformed path is rejected regardless of auth state, never a false 401/403/404 (FR-008).
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import * as roleController from "../controllers/role.controller";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";
import { parseRoleParam } from "../utils/roleParam";

export const roleRouter = Router({ strict: true });

/**
 * Middleware that validates the `:role` path parameter before authentication is checked, so a
 * malformed role name is rejected regardless of auth state (FR-008).
 *
 * @param req - Incoming request; `req.params.role` is validated.
 * @param _res - Unused.
 * @param next - Called with no argument on success; `parseRoleParam` throws (handled upstream) on an
 *   invalid role.
 */
function validateRoleParam(req: Request, _res: Response, next: NextFunction): void {
  parseRoleParam(req.params.role);
  next();
}

/**
 * Middleware that builds a `requireRole` check for the role named in `:role` — the required role is
 * the path value itself (FR-008), already validated by {@link validateRoleParam}.
 *
 * @param req - Incoming request; `req.params.role` supplies the required role.
 * @param res - Used by the underlying `requireRole` middleware to respond with 403 on mismatch.
 * @param next - Called on success (delegated to the underlying `requireRole` middleware).
 */
function requireMatchingRole(req: Request, res: Response, next: NextFunction): void {
  requireRole(parseRoleParam(req.params.role))(req, res, next);
}

roleRouter.get("/role/:role", validateRoleParam, authenticate, requireMatchingRole, roleController.getRoleDemo);
roleRouter.all("/role/:role", methodNotAllowedHandler);
