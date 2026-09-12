import type { Request, Response } from "express";
import * as cacheService from "../services/cache.service";
import { cacheResourceUpdateSchema } from "../models/cacheResource";

/**
 * Handles `GET /cache/resource`: serves `ETag`/`Last-Modified`/`Cache-Control`, returning `304`
 * with no body when the request's conditional headers match, else `200` with the full resource.
 * @param req - The incoming request; conditional headers are read from it.
 * @param res - Used to send the `200`/`304` response.
 */
export function getCacheResource(req: Request, res: Response): void {
  const resource = cacheService.getCacheResource();
  const etag = cacheService.buildEtag(resource.version);

  res.set("ETag", etag);
  res.set("Last-Modified", resource.updatedAt);
  res.set("Cache-Control", "public, max-age=60, must-revalidate");

  if (cacheService.matchesConditional(req, etag, resource.updatedAt)) {
    res.status(304).end();
    return;
  }

  res.status(200).json(resource);
}

/**
 * Handles `PUT /cache/resource`: replaces the resource's content and reissues its `ETag`/
 * `Last-Modified`, so any previously-valid conditional header falls back to `200` on the next GET.
 * @param req - The incoming request; the new content is read from its JSON body.
 * @param res - Used to send the `200` response.
 */
export function putCacheResource(req: Request, res: Response): void {
  const { content } = cacheResourceUpdateSchema.parse(req.body);
  const resource = cacheService.updateCacheResource(content);
  const etag = cacheService.buildEtag(resource.version);

  res.set("ETag", etag).set("Last-Modified", resource.updatedAt).status(200).json(resource);
}
