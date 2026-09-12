import { createInMemoryStore } from "./inMemoryStore";
import type { Product } from "../models/product";
import { PRODUCT_CATEGORIES } from "../models/enums";

export const productStore = createInMemoryStore<Product>();

const PRODUCT_COUNT = 50;

/**
 * Builds `PRODUCT_COUNT` deterministic seed products, cycling through every documented product
 * category with a formulaic price/stock spread.
 *
 * @returns The complete array of seed `Product` records.
 */
function buildSeedProducts(): Product[] {
  const now = new Date().toISOString();
  const products: Product[] = [];

  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    const category = PRODUCT_CATEGORIES[(i - 1) % PRODUCT_CATEGORIES.length];
    products.push({
      id: i,
      name: `Product ${i}`,
      description: `Seed product number ${i} in the ${category} category.`,
      price: Math.round((10 + i * 1.5) * 100) / 100,
      category,
      stock: 100 - (i % 50),
      createdAt: now,
      updatedAt: now,
    });
  }

  return products;
}

/** Deterministically (re)populates the product store — FR-002/FR-003. Also used by tests to reset state. */
export function seedProducts(): void {
  productStore.reset(buildSeedProducts());
}

seedProducts();
