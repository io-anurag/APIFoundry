import type { Scope } from "../models/enums";

/**
 * Rank of each per-resource scope level. A higher level includes every lower one on the same
 * resource: `execute` includes `write` and `read`, and `write` includes `read`.
 */
const SCOPE_LEVEL_RANK: Record<string, number> = { read: 1, write: 2, execute: 3 };

/**
 * Splits a `resource:level` scope into its parts. Returns `undefined` for scopes that have no
 * level (`admin`), so they never match through the hierarchy.
 */
function parseLeveledScope(scope: Scope): { resource: string; rank: number } | undefined {
  const [resource, level] = scope.split(":");
  const rank = level === undefined ? undefined : SCOPE_LEVEL_RANK[level];
  return rank === undefined ? undefined : { resource, rank };
}

/**
 * Checks whether a token's scopes satisfy a required scope. Scope levels are hierarchical per
 * resource (`read` < `write` < `execute`), so a token holding a higher level on the same resource
 * satisfies a lower requirement (e.g. `users:write` satisfies `users:read`). Levels never carry
 * across resources. The `admin` scope satisfies every scope check (FR-009).
 *
 * @param tokenScopes - The scopes granted to the current token.
 * @param required - The scope needed to authorize the action.
 * @returns `true` if `tokenScopes` includes `"admin"`, or includes a scope on the same resource at
 *   the same or a higher level than `required`.
 */
export function hasScope(tokenScopes: Scope[], required: Scope): boolean {
  if (tokenScopes.includes("admin") || tokenScopes.includes(required)) {
    return true;
  }

  const needed = parseLeveledScope(required);
  if (needed === undefined) {
    return false;
  }

  return tokenScopes.some((scope) => {
    const granted = parseLeveledScope(scope);
    return granted !== undefined && granted.resource === needed.resource && granted.rank >= needed.rank;
  });
}
