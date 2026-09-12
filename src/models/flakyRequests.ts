import { HttpError } from "../utils/httpError";

const FAILURE_RATE_PATTERN = /^(0(\.\d+)?|1(\.0+)?)$/;

/**
 * Parses and validates the `failureRate` query parameter for `GET /flaky`.
 *
 * @param raw - The raw query value (`undefined` when the parameter was omitted).
 * @param fallback - The value to use when `raw` is `undefined` (`config.failureRate`).
 * @returns The validated failure rate, a number in `[0, 1]`.
 * @throws HttpError 400 VALIDATION_ERROR if `raw` is present but not a decimal in `[0, 1]`.
 */
export function parseFailureRateParam(raw: unknown, fallback: number): number {
  if (raw === undefined) return fallback;

  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!FAILURE_RATE_PATTERN.test(trimmed)) {
    throw new HttpError(400, "VALIDATION_ERROR", "failureRate must be a decimal between 0 and 1.");
  }

  return Number(trimmed);
}
