import { orderStore } from "../data/orders.seed";
import { customerStore } from "../data/customers.seed";
import { productStore } from "../data/products.seed";
import { orderCreateSchema, orderPatchSchema, type Order, type OrderLineItem } from "../models/order";
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
