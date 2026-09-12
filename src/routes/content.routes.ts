/**
 * Content-type demo routes: `GET /content/:type` returns a fixed body in the requested content
 * type; `POST /content/:type` validates the request's `Content-Type` header. No authentication
 * required.
 */
import { Router } from "express";
import * as contentController from "../controllers/content.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const contentRouter = Router({ strict: true });

contentRouter.get("/content/:type", contentController.getContent);
contentRouter.post("/content/:type", contentController.postContent);
contentRouter.all("/content/:type", methodNotAllowedHandler);
