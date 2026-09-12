/**
 * Category routes: read-only listing/lookup by slug, plus the nested `products/:id/category` lookup.
 * No authentication is required on any of these routes.
 */
import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const categoryRouter = Router({ strict: true });

categoryRouter.get("/categories", categoryController.listCategories);
categoryRouter.all("/categories", methodNotAllowedHandler);

categoryRouter.get("/categories/:slug", categoryController.getCategoryBySlug);
categoryRouter.all("/categories/:slug", methodNotAllowedHandler);

categoryRouter.get("/products/:id/category", categoryController.getCategoryForProduct);
categoryRouter.all("/products/:id/category", methodNotAllowedHandler);
