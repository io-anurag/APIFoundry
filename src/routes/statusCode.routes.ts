import { Router } from "express";
import * as statusCodeController from "../controllers/statusCode.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const statusCodeRouter = Router({ strict: true });

statusCodeRouter.get("/status/:code", statusCodeController.demonstrateStatusCode);
statusCodeRouter.all("/status/:code", methodNotAllowedHandler);
