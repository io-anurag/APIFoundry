import { HttpError } from "./httpError";
import { DOCUMENTED_STATUS_CODES } from "../models/statusCodeDemo";

const STRICT_POSITIVE_INTEGER = /^[1-9]\d*$/;
const MIN_HTTP_STATUS = 100;
const MAX_HTTP_STATUS = 599;

/**
 * Parses a route's `:code` path segment for the status-code playground. Deliberately stricter than
 * idParam.ts's `\d+$` pattern: requiring no leading zero and no surrounding whitespace resolves the
 * Clarifications session's decision to reject (never normalize) values like "0200" or " 200 " (FR-010).
 * A value outside 100-599 is the "huge"/out-of-range case (FR-011); a value inside that range but not
 * one of the 24 documented codes is the "unsupported" case (FR-012), distinguished from FR-010/011 by a
 * dedicated error code.
 */
export function parseStatusCodeParam(raw: string): number {
  if (!STRICT_POSITIVE_INTEGER.test(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid status code '${raw}': must be a strict positive integer.`, {
      field: "code",
      value: raw,
    });
  }

  const code = Number(raw);
  if (code < MIN_HTTP_STATUS || code > MAX_HTTP_STATUS) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `Invalid status code '${raw}': must be between ${MIN_HTTP_STATUS} and ${MAX_HTTP_STATUS}.`,
      { field: "code", value: raw }
    );
  }

  if (!(DOCUMENTED_STATUS_CODES as readonly number[]).includes(code)) {
    throw new HttpError(400, "UNSUPPORTED_STATUS_CODE", `Status code ${code} is not supported by this endpoint.`, {
      field: "code",
      value: code,
      supportedCodes: DOCUMENTED_STATUS_CODES,
    });
  }

  return code;
}

/**
 * Optional-query-parameter companion to `parseStatusCodeParam`, for `GET /api/v1/test?status=`
 * (Spec 010). Returns `undefined` when `raw` is `undefined` (the caller omitted `status`
 * entirely); otherwise delegates to `parseStatusCodeParam` for the same strict-integer / range /
 * documented-code validation a required path parameter already gets.
 *
 * @param raw - The raw `?status=` query value (`undefined`, a string, or, per Express's
 *   query-parsing rules, an array or nested object).
 * @returns The validated status code, or `undefined` if omitted.
 */
export function parseOptionalStatusCodeParam(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;

  if (typeof raw !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid 'status' value: must be a single string value.`, {
      field: "status",
      value: raw,
    });
  }

  return parseStatusCodeParam(raw);
}
