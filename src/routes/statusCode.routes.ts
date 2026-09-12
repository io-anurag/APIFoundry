/**
 * `GET /status/:code`: returns the response matching the requested HTTP status code, for exercising
 * status-code handling in client tests. No authentication is required.
 */
import { Router } from "express";
import * as statusCodeController from "../controllers/statusCode.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const statusCodeRouter = Router({ strict: true });

statusCodeRouter.get("/status/:code", statusCodeController.demonstrateStatusCode);
statusCodeRouter.all("/status/:code", methodNotAllowedHandler);
