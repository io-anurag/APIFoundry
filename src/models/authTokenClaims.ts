import type { Scope, UserRole } from "./enums";

export const TOKEN_KINDS = ["valid", "expired", "invalid", "revoked"] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export type TokenType = "access" | "refresh";

/**
 * Claims common to both token types. `jsonwebtoken` adds iss/aud/iat/exp/jti at sign time, so they
 * aren't redeclared here.
 */
export interface BaseTokenClaims {
  sub: string;
  role: UserRole;
  scopes: Scope[];
  sid: string;
  type: TokenType;
  /** Set via jsonwebtoken's `jwtid` sign option; present on every verified/decoded token. */
  jti: string;
}

export interface AccessTokenClaims extends BaseTokenClaims {
  type: "access";
}

export interface RefreshTokenClaims extends BaseTokenClaims {
  type: "refresh";
}

/**
 * Computed by GET /auth/token-info (research.md Decision 6) — never stored, always recomputed from
 * the token presented in that same request.
 */
export type TokenInfoState =
  | "valid"
  | "expired"
  | "invalid-signature"
  | "wrong-issuer"
  | "wrong-audience"
  | "wrong-token-type"
  | "revoked";
