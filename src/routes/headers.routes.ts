/**
 * Header echo route: `GET /headers` reports every safe incoming request header. No
 * authentication required.
 */
import { Router } from "express";
import * as headersController from "../controllers/headers.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const headersRouter = Router({ strict: true });

headersRouter.get("/headers", headersController.getHeaders);
headersRouter.all("/headers", methodNotAllowedHandler);
