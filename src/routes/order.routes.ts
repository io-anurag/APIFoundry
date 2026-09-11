import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash does not alias the collection route (FR-006 edge case).
export const orderRouter = Router({ strict: true });

orderRouter.get("/orders", orderController.listOrders);
orderRouter.post("/orders", orderController.createOrder);
orderRouter.all("/orders", methodNotAllowedHandler);

orderRouter.get("/orders/:id", orderController.getOrderById);
orderRouter.put("/orders/:id", orderController.replaceOrder);
orderRouter.patch("/orders/:id", orderController.patchOrder);
orderRouter.delete("/orders/:id", orderController.deleteOrder);
orderRouter.all("/orders/:id", methodNotAllowedHandler);
