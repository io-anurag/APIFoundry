import { HttpError } from "./httpError";

const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * Parses `GET /payload?size=`'s `size` query value into a validated non-negative integer no
 * greater than `maxBytes`. Rejects non-numeric, negative, decimal, and empty values in one shot
 * via the strict `^\d+$` pattern (FR-005); rejects anything over `maxBytes` (FR-006).
 *
 * @param raw - The raw query value, of unknown shape until validated.
 * @param maxBytes - The configured maximum payload size in bytes, inclusive.
 * @returns The validated size in bytes.
 */
export function parsePayloadSizeParam(raw: unknown, maxBytes: number): number {
  if (typeof raw !== "string" || !NON_NEGATIVE_INTEGER.test(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid payload 'size' value: must be a non-negative integer.`, {
      field: "size",
      value: raw,
    });
  }

  const size = Number(raw);
  if (size > maxBytes) {
    throw new HttpError(400, "VALIDATION_ERROR", `Requested size ${size} bytes exceeds the maximum of ${maxBytes} bytes.`, {
      field: "size",
      value: size,
      max: maxBytes,
    });
  }

  return size;
}
