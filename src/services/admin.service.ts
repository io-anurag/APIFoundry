import { seedUsers } from "../data/users.seed";
import { seedProducts } from "../data/products.seed";
import { seedCustomers } from "../data/customers.seed";
import { seedOrders } from "../data/orders.seed";
import { seedCategories } from "../data/categories.seed";
import { seedPosts } from "../data/posts.seed";
import { seedComments } from "../data/comments.seed";
import { seedReviews } from "../data/reviews.seed";
import { seedPayments } from "../data/payments.seed";
import { rateLimitStore } from "../data/rateLimit.store";
import { idempotencyStore } from "../data/idempotency.store";
import { cacheResourceStore } from "../data/cacheResource.store";
import { fileStore, resetFileSequence } from "../data/files.store";
import { resetSeededRandom } from "../utils/seededRandom";
import { sessionStore } from "../data/session.store";
import { apiKeyStore } from "../data/apiKey.store";

/**
 * Restores every data-plane store to its deterministic seed state: every CRUD/read-oriented
 * resource, the rate limiter, the idempotency-key store, the cache-demo resource, uploaded files,
 * and the shared seeded PRNG. Never touches auth-domain state (`sessionStore`/`apiKeyStore`) — see
 * `resetAuthStores` for that. Call order mirrors `tests/helpers/resetStores.ts`'s original,
 * test-proven dependency order: customers/products before orders, users before posts/reviews, posts
 * before comments, products before reviews, orders before payments.
 */
export function resetDataStores(): void {
  seedUsers();
  seedProducts();
  seedCustomers();
  seedOrders();
  seedCategories();
  seedPosts();
  seedComments();
  seedReviews();
  seedPayments();
  rateLimitStore.reset([]);
  resetSeededRandom();
  idempotencyStore.reset([]);
  cacheResourceStore.reset();
  fileStore.reset([]);
  resetFileSequence();
}

/**
 * Restores every auth-plane store to its initial state: issued JWT session/refresh-token records
 * and issued/revoked API keys. Never touches data-plane state — see `resetDataStores` for that.
 */
export function resetAuthStores(): void {
  sessionStore.reset([]);
  apiKeyStore.reset([]);
}
