import { categoryStore } from "../data/categories.seed";
import { productStore } from "../data/products.seed";
import type { Category } from "../models/category";
import { HttpError } from "../utils/httpError";
import { parseListQuery } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "createdAt"] as const;

/**
 * Lists categories with filtering, sorting, and pagination applied.
 *
 * @param rawQuery - Raw query-string parameters (page, limit, sort, etc.), validated/parsed by `parseListQuery`.
 * @returns The matching page of categories plus the total count, page, and limit used.
 */
export function listCategories(
  rawQuery: Record<string, unknown>
): ListQueryResult<Category> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(categoryStore.list(), query);
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Looks up a single category by its slug.
 *
 * @param slug - The category slug to look up.
 * @returns The matching category.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no category has that slug.
 */
export function getCategoryBySlug(slug: string): Category {
  const category = categoryStore.get(slug);
  if (!category) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Category '${slug}' not found.`);
  return category;
}

/**
 * Returns the Category record matching a product's `category` string (products/:id/category,
 * FR-013). 404 if the product doesn't exist; also 404 (defensively — the seed guarantees this never
 * happens, research.md) if the product's category value has no matching Category record.
 *
 * @param productId - The id of the product whose category should be resolved.
 * @returns The category linked to the product.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if the product doesn't exist, or if its `category` value has no matching category record.
 */
export function getCategoryForProduct(productId: number): Category {
  const product = productStore.get(productId);
  if (!product) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${productId} not found.`);

  const category = categoryStore.get(product.category);
  if (!category) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Category '${product.category}' not found.`);
  }
  return category;
}
