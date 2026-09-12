/**
 * Info route: `GET /info` (mounted under the versioned API prefix by app.ts), returning general
 * server metadata. No authentication is required.
 */
import { Router } from "express";
import { getInfo } from "../controllers/info.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const infoRouter = Router();

infoRouter.get("/info", getInfo);
infoRouter.all("/info", methodNotAllowedHandler);
