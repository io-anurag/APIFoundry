import type { Request } from "express";
import { cacheResourceStore } from "../data/cacheResource.store";
import type { CacheResource } from "../models/cacheResource";

export const getCacheResource = cacheResourceStore.get;
export const updateCacheResource = (content: unknown): CacheResource => cacheResourceStore.update(content);

/**
 * Builds the `ETag` for a given resource version.
 * @param version - The resource's current version number.
 * @returns The `ETag` value, e.g. `"v3"`.
 */
export function buildEtag(version: number): string {
  return `"v${version}"`;
}

/**
 * Decides whether a conditional GET request matches the resource's current validators.
 * `If-None-Match` takes precedence over `If-Modified-Since` when both are present and disagree
 * (RFC 9110 §13.1.1; research.md Decision 7). A malformed value in either header is treated as
 * "does not match" rather than an error (spec.md Edge Cases).
 *
 * @param req - The incoming request; conditional headers are read from it.
 * @param etag - The resource's current `ETag`.
 * @param lastModified - The resource's current `Last-Modified` (ISO 8601 string).
 * @returns `true` if the request's conditional headers match the current resource state.
 */
export function matchesConditional(req: Request, etag: string, lastModified: string): boolean {
  const ifNoneMatch = req.header("If-None-Match");
  if (ifNoneMatch !== undefined) {
    return ifNoneMatch === etag;
  }

  const ifModifiedSince = req.header("If-Modified-Since");
  if (ifModifiedSince === undefined) return false;

  const since = Date.parse(ifModifiedSince);
  if (Number.isNaN(since)) return false;

  return since >= Date.parse(lastModified);
}
