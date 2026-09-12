import type { Request } from "express";
import { HttpError } from "../utils/httpError";
import { CONTENT_TYPE_DEMOS, type ContentType } from "../data/contentTypeDemos.catalog";
import { parseContentTypeParam } from "../utils/contentTypeParam";

/**
 * Resolves `GET /content/:type` into the demo body and media type for the validated content type.
 *
 * @param rawType - The raw `:type` path segment.
 * @returns `{ type, mediaType, body }` for the validated content type.
 */
export function getContentDemo(rawType: string): { type: ContentType; mediaType: string; body: string | object } {
  const type = parseContentTypeParam(rawType);
  const demo = CONTENT_TYPE_DEMOS[type];
  return { type, mediaType: demo.mediaType, body: demo.buildBody() };
}

/**
 * Validates `POST /content/:type`'s request `Content-Type` header against the expected media
 * type for the given `type`, via Express's built-in `req.is(...)` matcher (research.md Decision
 * 8) — correctly handles `; charset=...` suffixes, unlike a naive string comparison.
 *
 * @param req - The incoming request; its `Content-Type` header is checked.
 * @param rawType - The raw `:type` path segment.
 * @returns The validated content type, if the header matched.
 * @throws HttpError(400) if `rawType` is not a documented content type; HttpError(415) if the
 *   request's `Content-Type` header does not match that type's expected media type (FR-012).
 */
export function validateContentType(req: Request, rawType: string): ContentType {
  const type = parseContentTypeParam(rawType);
  const demo = CONTENT_TYPE_DEMOS[type];

  if (!req.is(demo.mediaType)) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      `Request Content-Type must be '${demo.mediaType}' for type '${type}'.`,
      { field: "Content-Type", expected: demo.mediaType, received: req.headers["content-type"] ?? null }
    );
  }

  return type;
}
