import { HttpError } from "./httpError";
import { CONTENT_TYPES, type ContentType } from "../data/contentTypeDemos.catalog";

/**
 * Parses a route's `:type` path segment for `GET`/`POST /content/{type}` into one of the
 * documented content types, rejecting anything else with `400` (FR-011).
 *
 * @param raw - The raw path segment value.
 * @returns The validated content type.
 */
export function parseContentTypeParam(raw: string): ContentType {
  if (!(CONTENT_TYPES as readonly string[]).includes(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid content type '${raw}': must be one of ${CONTENT_TYPES.join(", ")}.`, {
      field: "type",
      value: raw,
      supportedTypes: CONTENT_TYPES,
    });
  }

  return raw as ContentType;
}
