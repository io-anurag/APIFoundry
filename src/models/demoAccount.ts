import type { Scope, UserRole } from "./enums";

/**
 * A fixed, feature-owned demo identity for POST /auth/login — independent of the users CRUD
 * resource (spec.md Assumptions). Password is plaintext by design (research.md Decision 2): these
 * are synthetic, publicly-documented testing credentials, never real user data.
 */
export interface DemoAccount {
  username: string;
  password: string;
  role: UserRole;
  scopes: Scope[];
}
