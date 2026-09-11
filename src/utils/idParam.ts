import { HttpError } from "./httpError";

const POSITIVE_INTEGER = /^\d+$/;

/**
 * Parses a route's `:id` path segment into a positive integer. Never throws anything but
 * HttpError(400) — malformed, negative, zero, huge (beyond Number.MAX_SAFE_INTEGER), or empty
 * segments are all rejected here rather than reaching a store lookup (FR-006). A syntactically
 * valid id that simply doesn't exist is a 404, decided by the caller after a store miss, not here.
 */
export function parseIdParam(raw: string, resourceName = "resource"): number {
  if (!POSITIVE_INTEGER.test(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid ${resourceName} id '${raw}': must be a positive integer.`, {
      field: "id",
      value: raw,
    });
  }

  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid ${resourceName} id '${raw}': must be a positive integer.`, {
      field: "id",
      value: raw,
    });
  }

  return id;
}
