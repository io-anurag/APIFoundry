import { HttpError } from "./httpError";

const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * Parses a delay's `ms` value (from either the `:ms` path segment or the `?ms=` query parameter)
 * into a validated non-negative integer no greater than `maxMs`. Rejects non-numeric, negative,
 * decimal, empty, and whitespace-padded values in one shot via the strict `^\d+$` pattern
 * (FR-002); rejects anything over `maxMs` (FR-003).
 *
 * @param raw - The raw path or query value, of unknown shape until validated.
 * @param maxMs - The configured maximum delay (`config.maxDelayMs`), inclusive.
 * @returns The validated delay in milliseconds.
 */
export function parseDelayMsParam(raw: unknown, maxMs: number): number {
  if (typeof raw !== "string" || !NON_NEGATIVE_INTEGER.test(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid delay 'ms' value: must be a non-negative integer.`, {
      field: "ms",
      value: raw,
    });
  }

  const ms = Number(raw);
  if (ms > maxMs) {
    throw new HttpError(400, "VALIDATION_ERROR", `Requested delay ${ms}ms exceeds the maximum of ${maxMs}ms.`, {
      field: "ms",
      value: ms,
      max: maxMs,
    });
  }

  return ms;
}
