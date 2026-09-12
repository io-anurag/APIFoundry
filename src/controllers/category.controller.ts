import type { Request, Response } from "express";
import { parseSlugParam } from "../utils/slugParam";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as categoryService from "../services/category.service";

/**
 * Handles `GET /categories`: lists categories via `categoryService.listCategories`, applying the
 * pagination/sort/filter options in the query string, and responds `200` with a paginated
 * envelope built by `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listCategories(req: Request, res: Response): void {
  const { data, page, limit, total } = categoryService.listCategories(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /categories/:slug`: parses the `slug` path param via `parseSlugParam` and looks up
 * the category via `categoryService.getCategoryBySlug`, responding `200` with the category.
 * @param req - Express request; reads the `slug` path parameter.
 * @param res - Express response.
 */
export function getCategoryBySlug(req: Request, res: Response): void {
  const slug = parseSlugParam(req.params.slug);
  res.status(200).json(categoryService.getCategoryBySlug(slug));
}

/**
 * Handles `GET /products/:id/category`: parses the product `id` path param via `parseIdParam` and
 * resolves its category via `categoryService.getCategoryForProduct`, responding `200` with the
 * category.
 * @param req - Express request; reads the product `id` path parameter.
 * @param res - Express response.
 */
export function getCategoryForProduct(req: Request, res: Response): void {
  const productId = parseIdParam(req.params.id, "product");
  res.status(200).json(categoryService.getCategoryForProduct(productId));
}
