import { categoryStore } from "../data/categories.seed";
import { productStore } from "../data/products.seed";
import type { Category } from "../models/category";
import { HttpError } from "../utils/httpError";
import { parseListQuery } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "createdAt"] as const;

export function listCategories(
  rawQuery: Record<string, unknown>
): ListQueryResult<Category> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(categoryStore.list(), query);
  return { data, total, page: query.page, limit: query.limit };
}

export function getCategoryBySlug(slug: string): Category {
  const category = categoryStore.get(slug);
  if (!category) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Category '${slug}' not found.`);
  return category;
}

/**
 * Returns the Category record matching a product's `category` string (products/:id/category,
 * FR-013). 404 if the product doesn't exist; also 404 (defensively — the seed guarantees this never
 * happens, research.md) if the product's category value has no matching Category record.
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
