/**
 * Payload routes: `GET /payload/:preset` and `GET /payload?size=` generate a bounded response
 * body (User Story 2); `POST /payload` (added by User Story 3, T021) echoes the exact byte length
 * of the request body. No authentication required.
 */
import { Router } from "express";
import * as payloadController from "../controllers/payload.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const payloadRouter = Router({ strict: true });

payloadRouter.get("/payload/:preset", payloadController.getPayloadByPreset);
payloadRouter.all("/payload/:preset", methodNotAllowedHandler);

payloadRouter.get("/payload", payloadController.getPayloadBySize);
payloadRouter.post("/payload", payloadController.postPayload);
payloadRouter.all("/payload", methodNotAllowedHandler);
