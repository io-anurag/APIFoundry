import { HttpError } from "./httpError";

const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Parses a route's `:slug` path segment for a category. Never throws anything but HttpError(400) —
 * malformed (wrong case, underscores, leading/trailing/double hyphens, empty) segments are all
 * rejected here rather than reaching a store lookup (FR-006). A syntactically valid slug that simply
 * doesn't exist is a 404, decided by the caller after a store miss, not here.
 */
export function parseSlugParam(raw: string): string {
  if (!SLUG_FORMAT.test(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid category slug '${raw}': must be lowercase letters, digits, and single hyphens.`, {
      field: "slug",
      value: raw,
    });
  }

  return raw;
}
