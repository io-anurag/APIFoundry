import type { NextFunction, Request, Response } from "express";
import { hasScope } from "../auth/scopes";
import type { Scope } from "../models/enums";
import { HttpError } from "../utils/httpError";

/**
 * Builds middleware that restricts a route to callers holding a given scope. 403 with
 * INSUFFICIENT_SCOPE (not 401) — authenticated (`authenticate` must run first, populating
 * `req.auth`) but missing the required scope (FR-009/FR-015). Rejects with a 403 `HttpError`
 * (`INSUFFICIENT_SCOPE`, with `{ requiredScope, actualScopes }` details) when `hasScope` reports
 * `req.auth.scopes` does not satisfy `scope`; otherwise calls `next()` with no changes to `req`.
 *
 * @param scope - The scope a caller's `req.auth.scopes` must satisfy (directly, or via `"admin"`).
 * @returns An Express middleware enforcing that scope requirement.
 */
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
