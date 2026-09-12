import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { HttpError } from "../utils/httpError";

/**
 * Enforces the shared `X-Admin-Token` credential on every `/admin/*` route. A missing or
 * empty-string header is always "missing" — never a partial match against `config.adminToken`
 * (mirrors `apiKeyAuth.ts`'s same treatment of a missing `X-API-Key`). A present but non-matching
 * value (including one with stray whitespace) is rejected as incorrect, never crashing the request
 * handler. On success, calls `next()` with no argument.
 *
 * @param req - The incoming Express request; read for the `X-Admin-Token` header.
 * @param _res - Unused Express response.
 * @param next - Express callback; invoked with an `HttpError` on failure, or with no argument to continue.
 */
export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.header("X-Admin-Token");
  if (!token) {
    next(new HttpError(401, "UNAUTHORIZED", "Missing X-Admin-Token header", { reason: "missing" }));
    return;
  }

  if (token !== config.adminToken) {
    next(new HttpError(403, "FORBIDDEN", "Incorrect admin token", { reason: "incorrect" }));
    return;
  }

  next();
}
