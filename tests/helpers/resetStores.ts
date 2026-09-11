import { seedUsers } from "../../src/data/users.seed";
import { seedProducts } from "../../src/data/products.seed";
import { seedCustomers } from "../../src/data/customers.seed";
import { seedOrders } from "../../src/data/orders.seed";
import { seedCategories } from "../../src/data/categories.seed";
import { seedPosts } from "../../src/data/posts.seed";
import { seedComments } from "../../src/data/comments.seed";
import { seedReviews } from "../../src/data/reviews.seed";
import { seedPayments } from "../../src/data/payments.seed";

/**
 * Restores every in-memory store to its deterministic seeded state. Call from `beforeEach` in every
 * test file that mutates a store, since Vitest keeps one module registry per test file (state
 * otherwise leaks between `it()` blocks in the same file). Order matters: orders reference customers
 * and products; comments reference posts; posts and reviews reference users; reviews also reference
 * products; payments reference orders — each must be reseeded only after what it references.
 */
export function resetStores(): void {
  seedUsers();
  seedProducts();
  seedCustomers();
  seedOrders();
  seedCategories();
  seedPosts();
  seedComments();
  seedReviews();
  seedPayments();
}
