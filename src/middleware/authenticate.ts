import type { NextFunction, Request, Response } from "express";
import { sessionStore } from "../data/session.store";
import type { Scope, UserRole } from "../models/enums";
import { HttpError } from "../utils/httpError";
import { verifyToken, type VerifyFailureReason } from "../auth/jwt";

export interface AuthContext {
  sub: string;
  role: UserRole;
  scopes: Scope[];
  sid: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const REASON_MESSAGES: Record<VerifyFailureReason | "revoked" | "missing", string> = {
  missing: "Missing or malformed Authorization header",
  malformed: "Malformed JWT",
  expired: "Token has expired",
  "invalid-signature": "Invalid token signature",
  "wrong-issuer": "Token issuer does not match this server",
  "wrong-audience": "Token audience does not match this server",
  "wrong-token-type": "Wrong token type presented",
  revoked: "Token has been revoked",
};

/**
 * Extracts the bearer token from `Authorization: Bearer <token>`. A single strict regex rejects
 * every malformed-header variant (wrong scheme, missing token, extra whitespace, a duplicate header
 * that Node folds into one comma-joined string) in one shot, per the Edge Cases section.
 */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer (\S+)$/.exec(header);
  return match ? match[1] : null;
}

function unauthorized(reason: keyof typeof REASON_MESSAGES): HttpError {
  return new HttpError(401, "UNAUTHORIZED", REASON_MESSAGES[reason], { reason });
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(unauthorized("missing"));
    return;
  }

  const result = verifyToken(token, "access");
  if (!result.ok) {
    next(unauthorized(result.reason));
    return;
  }

  const session = sessionStore.get(result.claims.sid);
  if (!session || session.revoked) {
    next(unauthorized("revoked"));
    return;
  }

  req.auth = {
    sub: result.claims.sub,
    role: result.claims.role,
    scopes: result.claims.scopes,
    sid: result.claims.sid,
  };
  next();
}
