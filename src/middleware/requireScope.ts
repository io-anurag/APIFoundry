import type { NextFunction, Request, Response } from "express";
import { hasScope } from "../auth/scopes";
import type { Scope } from "../models/enums";
import { HttpError } from "../utils/httpError";

/** 403 with INSUFFICIENT_SCOPE (not 401) — authenticated but missing the required scope (FR-009/FR-015). */
export function requireScope(scope: Scope) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!hasScope(req.auth!.scopes, scope)) {
      next(
        new HttpError(403, "INSUFFICIENT_SCOPE", `Requires scope '${scope}'`, {
          requiredScope: scope,
          actualScopes: req.auth!.scopes,
        })
      );
      return;
    }
    next();
  };
}
