import { HttpError } from "./httpError";

const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a route's `:date` path segment (payments/by-date) as a real calendar date in `YYYY-MM-DD`
 * format. Never throws anything but HttpError(400) — wrong format AND syntactically-formatted-but-
 * invalid calendar dates (e.g. month 13, February 30) are both rejected here (FR-007). Round-trips
 * through `Date.UTC` rather than trusting `new Date(raw)`'s lenient parsing/normalization, so an
 * out-of-range month/day cannot silently roll over into a different date.
 */
export function parseDateParam(raw: string): string {
  const match = DATE_FORMAT.exec(raw);
  if (!match) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid date '${raw}': must be in YYYY-MM-DD format.`, {
      field: "date",
      value: raw,
    });
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const asDate = new Date(Date.UTC(year, month - 1, day));

  const isRealCalendarDate =
    asDate.getUTCFullYear() === year && asDate.getUTCMonth() === month - 1 && asDate.getUTCDate() === day;

  if (!isRealCalendarDate) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid date '${raw}': not a real calendar date.`, {
      field: "date",
      value: raw,
    });
  }

  return raw;
}
