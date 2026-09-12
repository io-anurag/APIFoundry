/**
 * `GET /version`: mounted outside the versioned API prefix, returning build/version metadata. No
 * authentication is required.
 */
import { Router } from "express";
import { getVersion } from "../controllers/version.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const versionRouter = Router();

versionRouter.get("/version", getVersion);
versionRouter.all("/version", methodNotAllowedHandler);
