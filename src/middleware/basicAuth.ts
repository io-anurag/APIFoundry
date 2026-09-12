import type { NextFunction, Request, Response } from "express";
import { BASIC_AUTH_DEMO_ACCOUNT } from "../data/basicAuthAccount.seed";
import { parseBasicAuthHeader } from "../auth/basicAuth";
import { HttpError } from "../utils/httpError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      basicAuthUser?: { username: string };
    }
  }
}

/**
 * Enforces HTTP Basic Auth against the single seeded demo account. A missing header and an
 * unparseable one both resolve to the same "malformed" reason (research.md Decision 5); a
 * well-formed but wrong username/password gets a separate, generic message that never reveals
 * whether the username exists (FR-011/Edge Cases).
 */
export function basicAuth(req: Request, _res: Response, next: NextFunction): void {
  const parsed = parseBasicAuthHeader(req.headers.authorization);
  if (!parsed) {
    next(new HttpError(401, "UNAUTHORIZED", "Missing or malformed Authorization header", { reason: "malformed" }));
    return;
  }

  if (parsed.username !== BASIC_AUTH_DEMO_ACCOUNT.username || parsed.password !== BASIC_AUTH_DEMO_ACCOUNT.password) {
    next(new HttpError(401, "UNAUTHORIZED", "Invalid username or password", { reason: "invalid-credentials" }));
    return;
  }

  req.basicAuthUser = { username: parsed.username };
  next();
}
