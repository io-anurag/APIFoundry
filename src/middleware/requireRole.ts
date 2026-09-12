import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../models/enums";
import { HttpError } from "../utils/httpError";

/**
 * Builds middleware that restricts a route to a single role. 403 (not 401) — the caller is
 * authenticated (`authenticate` must run first, populating `req.auth`) but lacks the required
 * role. Rejects with a 403 `HttpError` (`FORBIDDEN`, with `{ requiredRole, actualRole }` details)
 * when `req.auth.role` does not exactly match `role`; otherwise calls `next()` with no changes to `req`.
 *
 * @param role - The exact role a caller's `req.auth.role` must equal to pass.
 * @returns An Express middleware enforcing that role requirement.
 */
export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.auth!.role !== role) {
      next(
        new HttpError(403, "FORBIDDEN", `Requires role '${role}'`, {
          requiredRole: role,
          actualRole: req.auth!.role,
        })
      );
      return;
    }
    next();
  };
}
