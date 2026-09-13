/**
 * Product routes: full CRUD (`GET` list/one, `POST`, `PUT`, `PATCH`, `DELETE`), gated by
 * bearer-token auth — reads require the `products:read` scope, writes require `products:write`
 * (either satisfied by `admin`). `Router({ strict: true })` so a trailing slash does not alias the
 * collection route (FR-006 edge case).
 */
import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { authenticate } from "../middleware/authenticate";
import { requireScope } from "../middleware/requireScope";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash does not alias the collection route (FR-006 edge case).
export const productRouter = Router({ strict: true });

productRouter.get("/products", authenticate, requireScope("products:read"), productController.listProducts);
productRouter.post("/products", authenticate, requireScope("products:write"), productController.createProduct);
productRouter.all("/products", methodNotAllowedHandler);

productRouter.get("/products/:id", authenticate, requireScope("products:read"), productController.getProductById);
productRouter.put("/products/:id", authenticate, requireScope("products:write"), productController.replaceProduct);
productRouter.patch("/products/:id", authenticate, requireScope("products:write"), productController.patchProduct);
productRouter.delete("/products/:id", authenticate, requireScope("products:write"), productController.deleteProduct);
productRouter.all("/products/:id", methodNotAllowedHandler);
