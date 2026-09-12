import type { Scope } from "../models/enums";

/**
 * Checks whether a token's scopes satisfy a required scope. The `admin` scope satisfies every
 * scope check, regardless of which scope is required (FR-009).
 *
 * @param tokenScopes - The scopes granted to the current token.
 * @param required - The scope needed to authorize the action.
 * @returns `true` if `tokenScopes` includes `required` or includes `"admin"`.
 */
export function hasScope(tokenScopes: Scope[], required: Scope): boolean {
  return tokenScopes.includes(required) || tokenScopes.includes("admin");
}
