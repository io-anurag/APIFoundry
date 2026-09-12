import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { AccessTokenClaims, RefreshTokenClaims, TokenType } from "../models/authTokenClaims";
import type { Scope, UserRole } from "../models/enums";

/** Refresh tokens outlive access tokens by a fixed multiple — no new env var (research.md Decision 9). */
const REFRESH_LIFETIME_MULTIPLIER = 24;

interface IssueParams {
  sub: string;
  role: UserRole;
  scopes: Scope[];
  sid: string;
}

/**
 * Signs a JWT with the given subject/role/scopes/session claims plus a token `type` marker,
 * using the configured secret, issuer, and audience, and a fresh `jti` per call.
 *
 * @param params - The subject id, role, scopes, and session id to embed in the token.
 * @param type - The token kind (`"access"` or `"refresh"`) recorded in the `type` claim.
 * @param expiresInSeconds - Token lifetime in seconds from now.
 * @returns The signed, encoded JWT string.
 */
function sign(params: IssueParams, type: TokenType, expiresInSeconds: number): string {
  return jwt.sign({ sub: params.sub, role: params.role, scopes: params.scopes, sid: params.sid, type }, config.jwtSecret, {
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: expiresInSeconds,
    jwtid: randomUUID(),
  });
}

/**
 * Issues a signed access token for the given subject.
 *
 * @param params - The subject id, role, scopes, and session id to embed in the token.
 * @param expiresInSeconds - Token lifetime in seconds; defaults to the configured `jwtExpiresIn`.
 * @returns The signed access token string.
 */
export function signAccessToken(params: IssueParams, expiresInSeconds: number = config.jwtExpiresIn): string {
  return sign(params, "access", expiresInSeconds);
}

/**
 * Issues a signed refresh token for the given subject. Refresh tokens outlive access tokens by a
 * fixed multiple — no new env var (research.md Decision 9).
 *
 * @param params - The subject id, role, scopes, and session id to embed in the token.
 * @returns The signed refresh token string.
 */
export function signRefreshToken(params: IssueParams): string {
  return sign(params, "refresh", config.jwtExpiresIn * REFRESH_LIFETIME_MULTIPLIER);
}

/**
 * Flips one character in a token's signature segment — keeps it structurally decodable (still
 * three base64url-shaped, dot-separated parts) while guaranteeing signature verification fails
 * (research.md Decision 7, the `invalid` convenience-kind).
 *
 * @param token - A well-formed JWT string (`header.payload.signature`).
 * @returns The same token with one character of its signature segment flipped.
 */
export function corruptSignature(token: string): string {
  const parts = token.split(".");
  const signature = parts[2] ?? "";
  const flipped = signature.length > 0 ? (signature[0] === "A" ? "B" : "A") + signature.slice(1) : "corrupted";
  return `${parts[0]}.${parts[1]}.${flipped}`;
}

/**
 * Decodes a JWT's header and payload without verifying its signature or claims. Structural decode
 * only — never throws, used by GET /auth/token-info's 400 check (research.md Decision 6).
 *
 * @param token - The JWT string to decode.
 * @returns The decoded `{ header, payload, signature }` structure, or `null` if the token is not well-formed.
 */
export function decodeToken(token: string): jwt.Jwt | null {
  return jwt.decode(token, { complete: true });
}

export type VerifyFailureReason =
  | "expired"
  | "malformed"
  | "invalid-signature"
  | "wrong-issuer"
  | "wrong-audience"
  | "wrong-token-type";

export type VerifyResult =
  | { ok: true; claims: AccessTokenClaims | RefreshTokenClaims }
  | { ok: false; reason: VerifyFailureReason };

/**
 * Verifies signature, expiry, issuer, and audience, then checks the `type` claim matches
 * `expectedType`. Classifies every failure into one of VerifyFailureReason per FR-006/FR-014.
 *
 * @param token - The JWT string to verify.
 * @param expectedType - The token type (`"access"` or `"refresh"`) the token must declare.
 * @returns `{ ok: true, claims }` on success, or `{ ok: false, reason }` naming which check failed.
 */
export function verifyToken(token: string, expectedType: TokenType): VerifyResult {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret, {
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    }) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return { ok: false, reason: "expired" };
    if (err instanceof jwt.JsonWebTokenError) {
      if (err.message.includes("issuer")) return { ok: false, reason: "wrong-issuer" };
      if (err.message.includes("audience")) return { ok: false, reason: "wrong-audience" };
      if (err.message.includes("malformed")) return { ok: false, reason: "malformed" };
      return { ok: false, reason: "invalid-signature" };
    }
    return { ok: false, reason: "malformed" };
  }

  const claims = decoded as unknown as AccessTokenClaims | RefreshTokenClaims;
  if (claims.type !== expectedType) {
    return { ok: false, reason: "wrong-token-type" };
  }
  return { ok: true, claims };
}
