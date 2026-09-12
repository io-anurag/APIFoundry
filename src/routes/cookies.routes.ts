/**
 * Cookie management routes: `GET`/`POST`/`DELETE /cookies` set, read, and clear an arbitrary
 * number of independently-named cookies. No authentication required.
 */
import { Router } from "express";
import * as cookiesController from "../controllers/cookies.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const cookiesRouter = Router({ strict: true });

cookiesRouter.get("/cookies", cookiesController.getCookies);
cookiesRouter.post("/cookies", cookiesController.postCookies);
cookiesRouter.delete("/cookies", cookiesController.deleteCookies);
cookiesRouter.all("/cookies", methodNotAllowedHandler);
