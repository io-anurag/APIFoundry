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
