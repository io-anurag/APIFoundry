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

function assertCustomerExists(customerId: number): void {
  if (!customerStore.get(customerId)) {
    throw new HttpError(400, "VALIDATION_ERROR", `customerId ${customerId} does not reference an existing customer.`, {
      field: "customerId",
      value: customerId,
    });
  }
}

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

export function listOrders(
  rawQuery: Record<string, unknown>
): ListQueryResult<Order> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const status = lastQueryValue(rawQuery.status);
  const filters = status ? [(order: Order) => order.status === status] : [];
  const { data, total } = applyListQuery(orderStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

export function getOrder(id: number): Order {
  const order = orderStore.get(id);
  if (!order) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Order ${id} not found.`);
  return order;
}

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

export function deleteOrder(id: number): void {
  if (!orderStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Order ${id} not found.`);
  }
}

/**
 * Resolves a user's orders via the Customer.userId -> Order.customerId join established in Spec 002
 * (users/:id/orders, FR-009). Returns an empty paginated set, not 404, when the user exists but has
 * no linked customers/orders (FR-015).
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
