import type { Scope } from "../models/enums";

/** The `admin` scope satisfies every scope check, regardless of which scope is required (FR-009). */
export function hasScope(tokenScopes: Scope[], required: Scope): boolean {
  return tokenScopes.includes(required) || tokenScopes.includes("admin");
}
