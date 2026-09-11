import { productStore } from "../data/products.seed";
import { productCreateSchema, productPatchSchema, type Product } from "../models/product";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "price", "stock", "category", "createdAt"] as const;

export function listProducts(
  rawQuery: Record<string, unknown>
): ListQueryResult<Product> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const category = lastQueryValue(rawQuery.category);
  const filters = category ? [(product: Product) => product.category === category] : [];
  const { data, total } = applyListQuery(productStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

export function getProduct(id: number): Product {
  const product = productStore.get(id);
  if (!product) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${id} not found.`);
  return product;
}

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

export function patchProduct(id: number, rawBody: unknown): Product {
  const input = productPatchSchema.parse(rawBody);
  const updated = productStore.patch(id, { ...input, updatedAt: new Date().toISOString() });
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${id} not found.`);
  return updated;
}

export function deleteProduct(id: number): void {
  if (!productStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Product ${id} not found.`);
  }
}
