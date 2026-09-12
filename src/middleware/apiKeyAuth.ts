import type { NextFunction, Request, Response } from "express";
import { apiKeyStore } from "../data/apiKey.store";
import { computeStatus } from "../auth/apiKey";
import { HttpError } from "../utils/httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: { keyId: string; label: string | null };
    }
  }
}

const REASON_MESSAGES = {
  missing: "Missing X-API-Key header",
  unrecognized: "Unrecognized API key",
  expired: "API key has expired",
  revoked: "API key has been revoked",
} as const;

/**
 * Builds a 401 `HttpError` for a given API-key failure reason, using the matching message from
 * `REASON_MESSAGES`.
 *
 * @param reason - Which API-key check failed (`missing`, `unrecognized`, `expired`, or `revoked`).
 * @returns An `HttpError` with status 401, code `UNAUTHORIZED`, and `{ reason }` details.
 */
function unauthorized(reason: keyof typeof REASON_MESSAGES): HttpError {
  return new HttpError(401, "UNAUTHORIZED", REASON_MESSAGES[reason], { reason });
}

/**
 * Enforces `X-API-Key` on protected endpoints. A missing or empty-string header is always
 * "missing" — never a partial match against a stored key (Edge Cases). Looks up the key in
 * `apiKeyStore` and rejects with 401 `UNAUTHORIZED` if the header is absent, the key is
 * unrecognized, or `computeStatus` reports it `expired` or `revoked`. On success, attaches
 * `{ keyId, label }` to `req.apiKey` and calls `next()`.
 *
 * @param req - The incoming Express request; read for the `X-API-Key` header.
 * @param _res - Unused Express response.
 * @param next - Express callback; invoked with an `HttpError` on failure, or with no argument to continue.
 */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const key = req.header("X-API-Key");
  if (!key) {
    next(unauthorized("missing"));
    return;
  }

  const record = apiKeyStore.get(key);
  if (!record) {
    next(unauthorized("unrecognized"));
    return;
  }

  const status = computeStatus(record);
  if (status === "expired") {
    next(unauthorized("expired"));
    return;
  }
  if (status === "revoked") {
    next(unauthorized("revoked"));
    return;
  }

  req.apiKey = { keyId: record.keyId, label: record.label };
  next();
}
