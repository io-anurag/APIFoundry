import { createInMemoryStore } from "./inMemoryStore";
import type { Review } from "../models/review";
import { productStore } from "./products.seed";
import { userStore } from "./users.seed";

export const reviewStore = createInMemoryStore<Review>();

const REVIEW_COUNT = 120;
// Only the first 30 seeded products get reviews — a representative subset, not the full catalog
// (research.md) — while still exercising every rating value via REVIEW_COUNT's cycle length.
const REVIEWED_PRODUCT_COUNT = 30;

function buildSeedReviews(): Review[] {
  const now = new Date().toISOString();
  const products = productStore.list().slice(0, REVIEWED_PRODUCT_COUNT);
  const users = userStore.list();
  const reviews: Review[] = [];

  for (let i = 1; i <= REVIEW_COUNT; i++) {
    const product = products[(i - 1) % products.length];
    const author = users[(i - 1) % users.length];
    const rating = ((i - 1) % 5) + 1;
    reviews.push({
      id: i,
      productId: product.id,
      userId: author.id,
      rating,
      body: `Seeded review number ${i} for "${product.name}" — ${rating} star(s).`,
      createdAt: now,
    });
  }

  return reviews;
}

/**
 * Deterministically (re)populates the review store — FR-002/FR-003. Must run after products/users
 * have seeded (imported above) so every `productId`/`userId` reference resolves.
 */
export function seedReviews(): void {
  reviewStore.reset(buildSeedReviews());
}

seedReviews();
