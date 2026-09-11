import { SCOPES, type Scope } from "../models/enums";
import { HttpError } from "./httpError";

/**
 * Parses a route's `:scope` path segment. Never throws anything but HttpError(400) — any value
 * that isn't exactly one of the seven documented scopes is rejected here (FR-009), mirroring
 * `roleParam.ts`.
 */
export function parseScopeParam(raw: string): Scope {
  if (!(SCOPES as readonly string[]).includes(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid scope '${raw}': must be one of ${SCOPES.join(", ")}.`, {
      field: "scope",
      value: raw,
    });
  }

  return raw as Scope;
}
