import { Router } from "express";
import { getVersion } from "../controllers/version.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const versionRouter = Router();

versionRouter.get("/version", getVersion);
versionRouter.all("/version", methodNotAllowedHandler);
