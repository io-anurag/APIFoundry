import { createInMemoryStore } from "./inMemoryStore";
import type { Order, OrderLineItem } from "../models/order";
import { customerStore } from "./customers.seed";
import { productStore } from "./products.seed";
import { ORDER_STATUSES } from "../models/enums";

export const orderStore = createInMemoryStore<Order>();

const ORDER_COUNT = 100;

/**
 * Computes an order's total price by summing each line item's `product.price * quantity`,
 * rounded to two decimal places.
 *
 * @param items - The order's line items.
 * @param products - The full product catalog, used to look up each item's price.
 * @returns The order total, rounded to the nearest cent.
 */
function computeTotal(items: OrderLineItem[], products: ReturnType<typeof productStore.list>): number {
  const total = items.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    return sum + product.price * item.quantity;
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Builds `ORDER_COUNT` deterministic seed orders, cycling through seeded customers and products
 * (every fourth order also gets a second line item) and computing each order's total/status.
 *
 * @returns The complete array of seed `Order` records.
 */
function buildSeedOrders(): Order[] {
  const now = new Date().toISOString();
  const customers = customerStore.list();
  const products = productStore.list();
  const orders: Order[] = [];

  for (let i = 1; i <= ORDER_COUNT; i++) {
    const customer = customers[(i - 1) % customers.length];
    const primaryProduct = products[(i - 1) % products.length];
    const items: OrderLineItem[] = [{ productId: primaryProduct.id, quantity: (i % 3) + 1 }];

    if (i % 4 === 0) {
      const secondaryProduct = products[i % products.length];
      items.push({ productId: secondaryProduct.id, quantity: (i % 2) + 1 });
    }

    orders.push({
      id: i,
      customerId: customer.id,
      items,
      status: ORDER_STATUSES[(i - 1) % ORDER_STATUSES.length],
      total: computeTotal(items, products),
      createdAt: now,
      updatedAt: now,
    });
  }

  return orders;
}

/**
 * Deterministically (re)populates the order store — FR-002/FR-003. Must run after users/products/
 * customers have seeded (imported above) so every customerId/productId reference resolves.
 */
export function seedOrders(): void {
  orderStore.reset(buildSeedOrders());
}

seedOrders();
