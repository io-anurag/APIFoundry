import { Router, type NextFunction, type Request, type Response } from "express";
import * as scopeController from "../controllers/scope.controller";
import { authenticate } from "../middleware/authenticate";
import { requireScope } from "../middleware/requireScope";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";
import { parseScopeParam } from "../utils/scopeParam";

export const scopeRouter = Router({ strict: true });

// Validates :scope (400 on failure) before authentication is even checked, mirroring role.routes.ts.
function validateScopeParam(req: Request, _res: Response, next: NextFunction): void {
  parseScopeParam(req.params.scope);
  next();
}

/** The required scope is the path value itself (FR-009), already validated by validateScopeParam. */
function requireMatchingScope(req: Request, res: Response, next: NextFunction): void {
  requireScope(parseScopeParam(req.params.scope))(req, res, next);
}

scopeRouter.get("/scope/:scope", validateScopeParam, authenticate, requireMatchingScope, scopeController.getScopeDemo);
scopeRouter.all("/scope/:scope", methodNotAllowedHandler);
