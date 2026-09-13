/**
 * Order routes: full CRUD (`GET` list/one, `POST`, `PUT`, `PATCH`, `DELETE`) plus the nested
 * `users/:id/orders` and `orders/:id/products` lookups. Gated by bearer-token auth — reads
 * (including both nested lookups) require the `orders:read` scope, writes require `orders:write`
 * (either satisfied by `admin`). `Router({ strict: true })` so a trailing slash does not alias the
 * collection route (FR-006 edge case).
 */
import { Router } from "express";
import * as orderController from "../controllers/order.controller";
import { authenticate } from "../middleware/authenticate";
import { requireScope } from "../middleware/requireScope";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash does not alias the collection route (FR-006 edge case).
export const orderRouter = Router({ strict: true });

orderRouter.get("/orders", authenticate, requireScope("orders:read"), orderController.listOrders);
orderRouter.post("/orders", authenticate, requireScope("orders:write"), orderController.createOrder);
orderRouter.all("/orders", methodNotAllowedHandler);

orderRouter.get("/orders/:id", authenticate, requireScope("orders:read"), orderController.getOrderById);
orderRouter.put("/orders/:id", authenticate, requireScope("orders:write"), orderController.replaceOrder);
orderRouter.patch("/orders/:id", authenticate, requireScope("orders:write"), orderController.patchOrder);
orderRouter.delete("/orders/:id", authenticate, requireScope("orders:write"), orderController.deleteOrder);
orderRouter.all("/orders/:id", methodNotAllowedHandler);

orderRouter.get("/users/:id/orders", authenticate, requireScope("orders:read"), orderController.getOrdersForUser);
orderRouter.all("/users/:id/orders", methodNotAllowedHandler);

orderRouter.get("/orders/:id/products", authenticate, requireScope("orders:read"), orderController.getProductsForOrder);
orderRouter.all("/orders/:id/products", methodNotAllowedHandler);
