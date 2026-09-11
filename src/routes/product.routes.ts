import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash does not alias the collection route (FR-006 edge case).
export const productRouter = Router({ strict: true });

productRouter.get("/products", productController.listProducts);
productRouter.post("/products", productController.createProduct);
productRouter.all("/products", methodNotAllowedHandler);

productRouter.get("/products/:id", productController.getProductById);
productRouter.put("/products/:id", productController.replaceProduct);
productRouter.patch("/products/:id", productController.patchProduct);
productRouter.delete("/products/:id", productController.deleteProduct);
productRouter.all("/products/:id", methodNotAllowedHandler);
