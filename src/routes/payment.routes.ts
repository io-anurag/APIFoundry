/**
 * Payment routes: read-only listing/lookup by id, plus lookup by date. No authentication is required.
 */
import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const paymentRouter = Router({ strict: true });

paymentRouter.get("/payments", paymentController.listPayments);
paymentRouter.all("/payments", methodNotAllowedHandler);

paymentRouter.get("/payments/:id", paymentController.getPaymentById);
paymentRouter.all("/payments/:id", methodNotAllowedHandler);

paymentRouter.get("/payments/by-date/:date", paymentController.listPaymentsByDate);
paymentRouter.all("/payments/by-date/:date", methodNotAllowedHandler);
