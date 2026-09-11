import { HttpError } from "./httpError";

const RATING_INTEGER = /^\d+$/;

/**
 * Parses a route's `:rating` path segment (reviews/by-rating) into an integer from 1 to 5 inclusive.
 * Never throws anything but HttpError(400) — non-integer or out-of-range values are rejected here
 * rather than reaching a store lookup (FR-008). Every value 1-5 has seed data, so there is no
 * not-found case for this endpoint.
 */
export function parseRatingParam(raw: string): number {
  if (!RATING_INTEGER.test(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid rating '${raw}': must be an integer from 1 to 5.`, {
      field: "rating",
      value: raw,
    });
  }

  const rating = Number(raw);
  if (rating < 1 || rating > 5) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid rating '${raw}': must be an integer from 1 to 5.`, {
      field: "rating",
      value: raw,
    });
  }

  return rating;
}
