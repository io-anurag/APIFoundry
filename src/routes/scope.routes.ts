/**
 * `GET /scope/:scope`: scope-demo route. `:scope` is validated (400 on a bad value) before
 * authentication is even checked, mirroring role.routes.ts, then the caller must be authenticated and
 * hold the scope named in the path (FR-009).
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import * as scopeController from "../controllers/scope.controller";
import { authenticate } from "../middleware/authenticate";
import { requireScope } from "../middleware/requireScope";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";
import { parseScopeParam } from "../utils/scopeParam";

export const scopeRouter = Router({ strict: true });

/**
 * Middleware that validates the `:scope` path parameter before authentication is checked, mirroring
 * `validateRoleParam` in role.routes.ts.
 *
 * @param req - Incoming request; `req.params.scope` is validated.
 * @param _res - Unused.
 * @param next - Called with no argument on success; `parseScopeParam` throws (handled upstream) on an
 *   invalid scope.
 */
function validateScopeParam(req: Request, _res: Response, next: NextFunction): void {
  parseScopeParam(req.params.scope);
  next();
}

/**
 * Middleware that builds a `requireScope` check for the scope named in `:scope` — the required scope
 * is the path value itself (FR-009), already validated by {@link validateScopeParam}.
 *
 * @param req - Incoming request; `req.params.scope` supplies the required scope.
 * @param res - Used by the underlying `requireScope` middleware to respond with 403 on mismatch.
 * @param next - Called on success (delegated to the underlying `requireScope` middleware).
 */
function requireMatchingScope(req: Request, res: Response, next: NextFunction): void {
  requireScope(parseScopeParam(req.params.scope))(req, res, next);
}

scopeRouter.get("/scope/:scope", validateScopeParam, authenticate, requireMatchingScope, scopeController.getScopeDemo);
scopeRouter.all("/scope/:scope", methodNotAllowedHandler);
