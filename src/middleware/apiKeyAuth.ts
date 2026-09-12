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

function unauthorized(reason: keyof typeof REASON_MESSAGES): HttpError {
  return new HttpError(401, "UNAUTHORIZED", REASON_MESSAGES[reason], { reason });
}

/**
 * Enforces `X-API-Key` on protected endpoints. A missing or empty-string header is always
 * "missing" — never a partial match against a stored key (Edge Cases).
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
