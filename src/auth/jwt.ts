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

function sign(params: IssueParams, type: TokenType, expiresInSeconds: number): string {
  return jwt.sign({ sub: params.sub, role: params.role, scopes: params.scopes, sid: params.sid, type }, config.jwtSecret, {
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: expiresInSeconds,
    jwtid: randomUUID(),
  });
}

export function signAccessToken(params: IssueParams, expiresInSeconds: number = config.jwtExpiresIn): string {
  return sign(params, "access", expiresInSeconds);
}

export function signRefreshToken(params: IssueParams): string {
  return sign(params, "refresh", config.jwtExpiresIn * REFRESH_LIFETIME_MULTIPLIER);
}

/**
 * Flips one character in a token's signature segment — keeps it structurally decodable (still
 * three base64url-shaped, dot-separated parts) while guaranteeing signature verification fails
 * (research.md Decision 7, the `invalid` convenience-kind).
 */
export function corruptSignature(token: string): string {
  const parts = token.split(".");
  const signature = parts[2] ?? "";
  const flipped = signature.length > 0 ? (signature[0] === "A" ? "B" : "A") + signature.slice(1) : "corrupted";
  return `${parts[0]}.${parts[1]}.${flipped}`;
}

/** Structural decode only — never throws, used by GET /auth/token-info's 400 check (research.md Decision 6). */
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
