import { productStore } from "../data/products.seed";
import { productCreateSchema, productPatchSchema, type Product } from "../models/product";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "price", "stock", "category", "createdAt"] as const;

/**
 * Lists products with pagination/sorting, optionally filtered to a single `category`.
 *
 * @param rawQuery - Raw query-string parameters (page, limit, sort, category, etc.).
 * @returns The matching page of products plus the total count, page, and limit used.
 */
export function listProducts(
  rawQuery: Record<string, unknown>
): ListQueryResult<Product> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const category = lastQueryValue(rawQuery.category);
  const filters = category ? [(product: Product) => product.category === category] : [];
  const { data, total } = applyListQuery(productStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Looks up a single product by id.
 *
 * @param id - The product id to look up.
 * @returns The matching product.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no product has that id.
 */
export function getProduct(id: number): Product {
  const product = productStore.get(id);
  if (!product) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${id} not found.`);
  return product;
}

/**
 * Validates and creates a new product.
 *
 * @param rawBody - Request body validated against `productCreateSchema`.
 * @returns The newly created product record.
 */
export function createProduct(rawBody: unknown): Product {
  const input = productCreateSchema.parse(rawBody);
  const now = new Date().toISOString();
  return productStore.create((id) => ({
    id,
    name: input.name,
    description: input.description ?? "",
    price: input.price,
    category: input.category,
    stock: input.stock,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Fully replaces an existing product's fields.
 *
 * @param id - The id of the product to replace.
 * @param rawBody - Request body validated against `productCreateSchema`.
 * @returns The updated product record.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no product has that id.
 */
export function replaceProduct(id: number, rawBody: unknown): Product {
  const input = productCreateSchema.parse(rawBody);
  const updated = productStore.replace(id, (existing) => ({
    ...existing,
    name: input.name,
    description: input.description ?? "",
    price: input.price,
    category: input.category,
    stock: input.stock,
    updatedAt: new Date().toISOString(),
  }));
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${id} not found.`);
  return updated;
}

/**
 * Partially updates an existing product's fields.
 *
 * @param id - The id of the product to update.
 * @param rawBody - Request body validated against `productPatchSchema`; only present fields are applied.
 * @returns The updated product record.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no product has that id.
 */
export function patchProduct(id: number, rawBody: unknown): Product {
  const input = productPatchSchema.parse(rawBody);
  const updated = productStore.patch(id, { ...input, updatedAt: new Date().toISOString() });
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${id} not found.`);
  return updated;
}

/**
 * Deletes a product by id.
 *
 * @param id - The id of the product to delete.
 * @returns Nothing.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no product has that id.
 */
export function deleteProduct(id: number): void {
  if (!productStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${id} not found.`);
  }
}
