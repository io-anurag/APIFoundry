import { createKeyedStore } from "./keyedStore";
import type { Category } from "../models/category";
import { PRODUCT_CATEGORIES } from "../models/enums";

export const categoryStore = createKeyedStore<Category>();

/** Lowercases, hyphenates, and strips anything outside the slug alphabet. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Catalog-only categories not currently referenced by any seeded product (research.md) — additive to
// the 10 PRODUCT_CATEGORIES values below, which every seeded product's `category` string resolves
// against via `products/:id/category`.
const CATALOG_ONLY_CATEGORY_NAMES = [
  "Seasonal",
  "Clearance",
  "Featured",
  "Bestsellers",
  "New Arrivals",
  "Limited Edition",
  "Trending",
  "Top Rated",
  "Gift Ideas",
  "Eco Friendly",
  "Staff Picks",
  "On Sale",
];

function buildSeedCategories(): Category[] {
  const now = new Date().toISOString();
  const categories: Category[] = [];

  for (const productCategory of PRODUCT_CATEGORIES) {
    categories.push({
      id: productCategory,
      name: titleCase(productCategory),
      description: `Products in the ${titleCase(productCategory)} category.`,
      createdAt: now,
    });
  }

  for (const name of CATALOG_ONLY_CATEGORY_NAMES) {
    const slug = slugify(name);
    categories.push({
      id: slug,
      name,
      description: `Curated catalog category: ${name}.`,
      createdAt: now,
    });
  }

  return categories;
}

/** Deterministically (re)populates the category store — FR-002/FR-003. */
export function seedCategories(): void {
  categoryStore.reset(buildSeedCategories());
}

seedCategories();
