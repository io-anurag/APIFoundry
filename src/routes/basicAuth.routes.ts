/**
 * Basic-auth demo route: `GET /auth-test/basic`, gated by the `basicAuth` middleware, to exercise
 * valid/invalid/missing/malformed `Authorization: Basic` credential cases.
 */
import { Router } from "express";
import * as basicAuthController from "../controllers/basicAuth.controller";
import { basicAuth } from "../middleware/basicAuth";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const basicAuthRouter = Router({ strict: true });

basicAuthRouter.get("/auth-test/basic", basicAuth, basicAuthController.getBasicAuthDemo);
basicAuthRouter.all("/auth-test/basic", methodNotAllowedHandler);
