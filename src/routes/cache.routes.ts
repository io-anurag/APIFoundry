/**
 * Cache-demo route: `GET /cache/resource` serves ETag/Last-Modified/Cache-Control and honors
 * conditional headers; `PUT /cache/resource` updates the content and reissues both validators.
 * No authentication required.
 */
import { Router } from "express";
import * as cacheController from "../controllers/cache.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const cacheRouter = Router({ strict: true });

cacheRouter.get("/cache/resource", cacheController.getCacheResource);
cacheRouter.put("/cache/resource", cacheController.putCacheResource);
cacheRouter.all("/cache/resource", methodNotAllowedHandler);
