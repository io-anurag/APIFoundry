import type { Request, Response } from "express";
import { parseSlugParam } from "../utils/slugParam";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as categoryService from "../services/category.service";

export function listCategories(req: Request, res: Response): void {
  const { data, page, limit, total } = categoryService.listCategories(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getCategoryBySlug(req: Request, res: Response): void {
  const slug = parseSlugParam(req.params.slug);
  res.status(200).json(categoryService.getCategoryBySlug(slug));
}

export function getCategoryForProduct(req: Request, res: Response): void {
  const productId = parseIdParam(req.params.id, "product");
  res.status(200).json(categoryService.getCategoryForProduct(productId));
}
