import { Router } from "express";
import { getInfo } from "../controllers/info.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const infoRouter = Router();

infoRouter.get("/info", getInfo);
infoRouter.all("/info", methodNotAllowedHandler);
