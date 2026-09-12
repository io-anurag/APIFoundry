import { orderStore } from "../data/orders.seed";
import { customerStore } from "../data/customers.seed";
import { productStore } from "../data/products.seed";
import { userStore } from "../data/users.seed";
import { orderCreateSchema, orderPatchSchema, type Order, type OrderLineItem } from "../models/order";
import type { Product } from "../models/product";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "customerId", "status", "total", "createdAt"] as const;

/**
 * Ensures `customerId` references an existing customer.
 *
 * @param customerId - The customer id to check.
 * @throws HttpError 400 VALIDATION_ERROR if no matching customer exists.
 */
function assertCustomerExists(customerId: number): void {
  if (!customerStore.get(customerId)) {
    throw new HttpError(400, "VALIDATION_ERROR", `customerId ${customerId} does not reference an existing customer.`, {
      field: "customerId",
      value: customerId,
    });
  }
}

/**
 * Validates that every line item references an existing product, and computes the order's total.
 *
 * @param items - The order's requested line items.
 * @returns The same items alongside their computed total price.
 * @throws HttpError 400 VALIDATION_ERROR if any item's `productId` doesn't reference an existing product.
 */
function resolveItemsAndTotal(items: OrderLineItem[]): { items: OrderLineItem[]; total: number } {
  let total = 0;
  for (const item of items) {
    const product = productStore.get(item.productId);
    if (!product) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        `items[].productId ${item.productId} does not reference an existing product.`,
        { field: "items.productId", value: item.productId }
      );
    }
    total += product.price * item.quantity;
  }
  return { items, total: Math.round(total * 100) / 100 };
}

/**
 * Lists orders with pagination/sorting, optionally filtered to a single `status`.
 *
 * @param rawQuery - Raw query-string parameters (page, limit, sort, status, etc.).
 * @returns The matching page of orders plus the total count, page, and limit used.
 */
export function listOrders(
  rawQuery: Record<string, unknown>
): ListQueryResult<Order> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const status = lastQueryValue(rawQuery.status);
  const filters = status ? [(order: Order) => order.status === status] : [];
  const { data, total } = applyListQuery(orderStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Looks up a single order by id.
 *
 * @param id - The order id to look up.
 * @returns The matching order.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no order has that id.
 */
export function getOrder(id: number): Order {
  const order = orderStore.get(id);
  if (!order) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Order ${id} not found.`);
  return order;
}

/**
 * Validates and creates a new order, resolving line-item products and computing the order total
 * from current product prices.
 *
 * @param rawBody - Request body validated against `orderCreateSchema`.
 * @returns The newly created order record, including resolved line items and computed total.
 * @throws HttpError 400 VALIDATION_ERROR if `customerId` does not reference an existing customer, or if any line item's `productId` does not reference an existing product.
 */
export function createOrder(rawBody: unknown): Order {
  const input = orderCreateSchema.parse(rawBody);
  assertCustomerExists(input.customerId);
  const { items, total } = resolveItemsAndTotal(input.items);

  const now = new Date().toISOString();
  return orderStore.create((id) => ({
    id,
    customerId: input.customerId,
    items,
    status: input.status ?? "pending",
    total,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Fully replaces an existing order's fields, recomputing its line items and total.
 *
 * @param id - The id of the order to replace.
 * @param rawBody - Request body validated against `orderCreateSchema`.
 * @returns The updated order record.
 * @throws HttpError 400 VALIDATION_ERROR if `customerId` does not reference an existing customer, or if any line item's `productId` does not reference an existing product.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no order has that id.
 */
export function replaceOrder(id: number, rawBody: unknown): Order {
  const input = orderCreateSchema.parse(rawBody);
  assertCustomerExists(input.customerId);
  const { items, total } = resolveItemsAndTotal(input.items);

  const updated = orderStore.replace(id, (existing) => ({
    ...existing,
    customerId: input.customerId,
    items,
    status: input.status ?? "pending",
    total,
    updatedAt: new Date().toISOString(),
  }));
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Order ${id} not found.`);
  return updated;
}

/**
 * Partially updates an existing order's fields. If `items` is supplied, line items and the order
 * total are recomputed from current product prices.
 *
 * @param id - The id of the order to update.
 * @param rawBody - Request body validated against `orderPatchSchema`; only present fields are applied.
 * @returns The updated order record.
 * @throws HttpError 400 VALIDATION_ERROR if `customerId` is set but does not reference an existing customer, or if any new line item's `productId` does not reference an existing product.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no order has that id.
 */
export function patchOrder(id: number, rawBody: unknown): Order {
  const input = orderPatchSchema.parse(rawBody);
  if (input.customerId !== undefined) assertCustomerExists(input.customerId);

  const existing = orderStore.get(id);
  if (!existing) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Order ${id} not found.`);

  const resolved = input.items !== undefined ? resolveItemsAndTotal(input.items) : undefined;

  const updated = orderStore.patch(id, {
    ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
    ...(resolved ? { items: resolved.items, total: resolved.total } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    updatedAt: new Date().toISOString(),
  });
  return updated!;
}

/**
 * Deletes an order by id.
 *
 * @param id - The id of the order to delete.
 * @returns Nothing.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no order has that id.
 */
export function deleteOrder(id: number): void {
  if (!orderStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Order ${id} not found.`);
  }
}

/**
 * Resolves a user's orders via the Customer.userId -> Order.customerId join established in Spec 002
 * (users/:id/orders, FR-009). Returns an empty paginated set, not 404, when the user exists but has
 * no linked customers/orders (FR-015).
 *
 * @param userId - The id of the user whose orders should be listed.
 * @param rawQuery - Raw query-string parameters (page, limit, sort, etc.).
 * @returns The matching page of orders plus the total count, page, and limit used.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if the user doesn't exist.
 */
export function listOrdersForUser(
  userId: number,
  rawQuery: Record<string, unknown>
): ListQueryResult<Order> & { page: number; limit: number } {
  if (!userStore.get(userId)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${userId} not found.`);
  }

  const linkedCustomerIds = new Set(
    customerStore.list().filter((customer) => customer.userId === userId).map((customer) => customer.id)
  );

  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(orderStore.list(), query, {
    filters: [(order: Order) => linkedCustomerIds.has(order.customerId)],
  });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Returns the distinct products referenced by an order's line items (orders/:id/products, FR-014).
 *
 * @param orderId - The id of the order whose line-item products should be listed.
 * @param rawQuery - Raw query-string parameters (page, limit, sort, etc.).
 * @returns The matching page of distinct products plus the total count, page, and limit used.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if the order doesn't exist.
 */
export function listProductsForOrder(
  orderId: number,
  rawQuery: Record<string, unknown>
): ListQueryResult<Product> & { page: number; limit: number } {
  const order = orderStore.get(orderId);
  if (!order) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Order ${orderId} not found.`);

  const distinctProductIds = new Set(order.items.map((item) => item.productId));
  const products = productStore.list().filter((product) => distinctProductIds.has(product.id));

  const query = parseListQuery(rawQuery, { allowedSortFields: ["id", "name", "price", "stock", "category", "createdAt"] });
  const { data, total } = applyListQuery(products, query);
  return { data, total, page: query.page, limit: query.limit };
}
