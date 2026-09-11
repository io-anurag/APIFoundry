import { seedUsers } from "../../src/data/users.seed";
import { seedProducts } from "../../src/data/products.seed";
import { seedCustomers } from "../../src/data/customers.seed";
import { seedOrders } from "../../src/data/orders.seed";

/**
 * Restores all four in-memory stores to their deterministic seeded state. Call from `beforeEach` in
 * every test file that mutates a store, since Vitest keeps one module registry per test file (state
 * otherwise leaks between `it()` blocks in the same file). Order matters: orders reference customers
 * and products, so those must be reseeded first.
 */
export function resetStores(): void {
  seedUsers();
  seedProducts();
  seedCustomers();
  seedOrders();
}
