import { randomUUID } from "node:crypto";
import { findDemoAccount } from "../data/demoAccounts.seed";
import { sessionStore } from "../data/session.store";
import { config } from "../config";
import { loginRequestSchema, refreshRequestSchema, tokenIssueRequestSchema } from "../models/authRequests";
import type { TokenInfoState } from "../models/authTokenClaims";
import type { AuthContext } from "../middleware/authenticate";
import { corruptSignature, decodeToken, signAccessToken, signRefreshToken, verifyToken } from "../auth/jwt";
import { HttpError } from "../utils/httpError";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

function invalidCredentials(): HttpError {
  // Deliberately identical for "unknown username" and "wrong password" — never reveal which (Edge Cases).
  return new HttpError(401, "UNAUTHORIZED", "Invalid username or password");
}

export function login(rawBody: unknown): TokenPair {
  const { username, password } = loginRequestSchema.parse(rawBody);
  const account = findDemoAccount(username);
  if (!account || account.password !== password) {
    throw invalidCredentials();
  }

  const sid = randomUUID();
  const accessToken = signAccessToken({ sub: account.username, role: account.role, scopes: account.scopes, sid });
  const refreshToken = signRefreshToken({ sub: account.username, role: account.role, scopes: account.scopes, sid });
  const refreshClaims = verifyToken(refreshToken, "refresh");
  const refreshJti = refreshClaims.ok ? refreshClaims.claims.jti : null;

  sessionStore.create({ id: sid, sub: account.username, revoked: false, currentRefreshJti: refreshJti });

  return { accessToken, refreshToken, tokenType: "Bearer", expiresIn: config.jwtExpiresIn };
}

export function getMe(auth: AuthContext): { sub: string; role: AuthContext["role"]; scopes: AuthContext["scopes"] } {
  return { sub: auth.sub, role: auth.role, scopes: auth.scopes };
}

/**
 * Verifies signature/expiry/issuer/audience/type but deliberately does NOT check `session.revoked`
 * (research.md Decision 5) — an already-revoked token from a prior logout must still succeed here
 * (idempotent 200), while a token that never passes verification is a 401.
 */
export function logout(token: string): void {
  const result = verifyToken(token, "access");
  if (!result.ok) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired token", { reason: result.reason });
  }
  sessionStore.replace(result.claims.sid, (session) => ({ ...session, revoked: true }));
}

export function refresh(rawBody: unknown): TokenPair {
  const { refreshToken } = refreshRequestSchema.parse(rawBody);
  const result = verifyToken(refreshToken, "refresh");
  if (!result.ok) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired refresh token", { reason: result.reason });
  }

  const claims = result.claims;
  const session = sessionStore.get(claims.sid);
  if (!session || session.revoked || claims.jti !== session.currentRefreshJti) {
    throw new HttpError(401, "UNAUTHORIZED", "Refresh token has already been rotated or revoked");
  }

  const accessToken = signAccessToken({ sub: claims.sub, role: claims.role, scopes: claims.scopes, sid: claims.sid });
  const newRefreshToken = signRefreshToken({ sub: claims.sub, role: claims.role, scopes: claims.scopes, sid: claims.sid });
  const newRefreshClaims = verifyToken(newRefreshToken, "refresh");
  const newRefreshJti = newRefreshClaims.ok ? newRefreshClaims.claims.jti : null;

  sessionStore.replace(claims.sid, (existing) => ({ ...existing, currentRefreshJti: newRefreshJti }));

  return { accessToken, refreshToken: newRefreshToken, tokenType: "Bearer", expiresIn: config.jwtExpiresIn };
}

/** Already elapsed by the time it's returned — deterministically triggers TokenExpiredError (research.md Decision 7). */
const EXPIRED_OFFSET_SECONDS = -10;

export interface TokenIssueResult {
  accessToken: string;
  tokenType: "Bearer";
  kind: string;
}

/**
 * Issues a token directly for a chosen role/scopes/kind, without a real login (FR-005). Every kind
 * still gets its own session, so revocation/token-info behave uniformly whether a token came from
 * login or from here (research.md Decision 7).
 */
export function issueConvenienceToken(rawBody: unknown): TokenIssueResult {
  const { role, scopes, kind } = tokenIssueRequestSchema.parse(rawBody);
  const sid = randomUUID();
  const params = { sub: role, role, scopes, sid };

  let accessToken: string;
  switch (kind) {
    case "expired":
      accessToken = signAccessToken(params, EXPIRED_OFFSET_SECONDS);
      break;
    case "invalid":
      accessToken = corruptSignature(signAccessToken(params));
      break;
    case "valid":
    case "revoked":
      accessToken = signAccessToken(params);
      break;
  }

  sessionStore.create({ id: sid, sub: role, revoked: kind === "revoked", currentRefreshJti: null });

  return { accessToken, tokenType: "Bearer", kind };
}

export interface TokenInfoResult {
  state: TokenInfoState;
  claims: Record<string, unknown>;
}

/**
 * Never gated by `authenticate` (research.md Decision 6) — this endpoint's entire purpose is to
 * report on tokens `authenticate` would reject. Only a structurally undecodable token is a 400.
 */
export function getTokenInfo(token: string): TokenInfoResult {
  const decoded = decodeToken(token);
  if (!decoded || typeof decoded.payload !== "object") {
    throw new HttpError(400, "VALIDATION_ERROR", "Malformed token");
  }

  const result = verifyToken(token, "access");
  let state: TokenInfoState;
  if (!result.ok) {
    state = result.reason === "malformed" ? "invalid-signature" : result.reason;
  } else {
    const session = sessionStore.get(result.claims.sid);
    state = session?.revoked ? "revoked" : "valid";
  }

  return { state, claims: decoded.payload as Record<string, unknown> };
}
