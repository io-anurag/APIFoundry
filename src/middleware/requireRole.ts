import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../models/enums";
import { HttpError } from "../utils/httpError";

/** 403 (not 401) — the caller is authenticated (authenticate must run first) but lacks the required role. */
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
