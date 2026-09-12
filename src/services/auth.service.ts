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

/**
 * Builds the standard 401 error for a failed login. Deliberately identical for "unknown username"
 * and "wrong password" — never reveal which (Edge Cases).
 *
 * @returns An `HttpError` with status 401 and code `UNAUTHORIZED`.
 */
function invalidCredentials(): HttpError {
  return new HttpError(401, "UNAUTHORIZED", "Invalid username or password");
}

/**
 * Authenticates a demo account by username/password and issues a fresh access/refresh token pair.
 * A new session is created and tracked so the refresh token can later be validated and rotated.
 *
 * @param rawBody - Request body containing `username` and `password`, validated against `loginRequestSchema`.
 * @returns The signed access token, refresh token, token type, and expiry (in seconds).
 * @throws HttpError 401 UNAUTHORIZED if the username is unknown or the password does not match — the same error is used for both cases so callers cannot distinguish them.
 */
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

/**
 * Returns the identity of the currently authenticated caller.
 *
 * @param auth - The authenticated request context populated by the `authenticate` middleware.
 * @returns The subject, role, and scopes carried by the caller's verified token.
 */
export function getMe(auth: AuthContext): { sub: string; role: AuthContext["role"]; scopes: AuthContext["scopes"] } {
  return { sub: auth.sub, role: auth.role, scopes: auth.scopes };
}

/**
 * Logs the caller out by marking their session as revoked. Verifies signature/expiry/issuer/
 * audience/type but deliberately does NOT check `session.revoked` (research.md Decision 5) — an
 * already-revoked token from a prior logout must still succeed here (idempotent 200), while a
 * token that never passes verification is a 401.
 *
 * @param token - The access token identifying the session to revoke.
 * @returns Nothing; the session is marked revoked as a side effect.
 * @throws HttpError 401 UNAUTHORIZED if the token fails signature/expiry/issuer/audience/type verification.
 */
export function logout(token: string): void {
  const result = verifyToken(token, "access");
  if (!result.ok) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired token", { reason: result.reason });
  }
  sessionStore.replace(result.claims.sid, (session) => ({ ...session, revoked: true }));
}

/**
 * Rotates a refresh token: validates it against the tracked session's current refresh JTI (so a
 * stale or already-rotated refresh token is rejected), then issues and stores a new access/refresh
 * token pair for the same session.
 *
 * @param rawBody - Request body containing `refreshToken`, validated against `refreshRequestSchema`.
 * @returns A new signed access token, refresh token, token type, and expiry (in seconds).
 * @throws HttpError 401 UNAUTHORIZED if the refresh token fails verification, or if the session is missing/revoked, or if the token's `jti` no longer matches the session's current refresh token (already rotated).
 */
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
 * login or from here (research.md Decision 7). "expired" tokens are signed already in the past;
 * "invalid" tokens are signed validly and then have their signature corrupted; "revoked" tokens are
 * signed validly but their session is immediately marked revoked.
 *
 * @param rawBody - Request body containing `role`, `scopes`, and `kind` ("valid" | "expired" | "invalid" | "revoked"), validated against `tokenIssueRequestSchema`.
 * @returns The issued access token, its token type, and the requested `kind`.
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
 * Reports the state of a token (valid, expired, invalid-signature, revoked, etc.) and decodes its
 * claims for inspection. Never gated by `authenticate` (research.md Decision 6) — this endpoint's
 * entire purpose is to report on tokens `authenticate` would reject. Only a structurally
 * undecodable token is a 400.
 *
 * @param token - The token to inspect; need not be currently valid.
 * @returns The token's computed state and its decoded (unverified) claims payload.
 * @throws HttpError 400 VALIDATION_ERROR if the token cannot be decoded at all (malformed structure).
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
