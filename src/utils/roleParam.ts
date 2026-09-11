import { USER_ROLES, type UserRole } from "../models/enums";
import { HttpError } from "./httpError";

/**
 * Parses a route's `:role` path segment. Never throws anything but HttpError(400) — any value that
 * isn't exactly one of the four documented roles is rejected here (FR-008), never a false
 * `403`/`404`.
 */
export function parseRoleParam(raw: string): UserRole {
  if (!(USER_ROLES as readonly string[]).includes(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid role '${raw}': must be one of ${USER_ROLES.join(", ")}.`, {
      field: "role",
      value: raw,
    });
  }

  return raw as UserRole;
}
