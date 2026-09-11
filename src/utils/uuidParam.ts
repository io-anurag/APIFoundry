import { HttpError } from "./httpError";

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses a route's `:id` path segment for a UUID-keyed resource (posts, payments). Never throws
 * anything but HttpError(400) — malformed (wrong length, missing hyphens, non-hex, empty) segments
 * are all rejected here rather than reaching a store lookup (FR-006). A well-formed UUID that simply
 * doesn't exist is a 404, decided by the caller after a store miss, not here.
 */
export function parseUuidParam(raw: string, resourceName = "resource"): string {
  if (!UUID_FORMAT.test(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid ${resourceName} id '${raw}': must be a valid UUID.`, {
      field: "id",
      value: raw,
    });
  }

  return raw.toLowerCase();
}
