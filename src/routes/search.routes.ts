import { Router } from "express";
import * as searchController from "../controllers/search.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const searchRouter = Router({ strict: true });

searchRouter.get("/search", searchController.search);
searchRouter.all("/search", methodNotAllowedHandler);
