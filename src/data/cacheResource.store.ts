import type { CacheResource } from "../models/cacheResource";

const SEED_CONTENT = { message: "Hello, cache!" };
const SEED_UPDATED_AT = "2026-01-01T00:00:00.000Z";

let resource: CacheResource = { content: SEED_CONTENT, version: 1, updatedAt: SEED_UPDATED_AT };

export const cacheResourceStore = {
  /**
   * Returns the current cache-demo resource.
   * @returns The current `CacheResource`.
   */
  get(): CacheResource {
    return resource;
  },

  /**
   * Replaces the resource's content, incrementing its version and stamping a fresh `updatedAt`
   * (research.md Decision 6 — a monotonically incrementing version, not a content hash, keeps the
   * `ETag` trivially O(1) to compute and compare).
   * @param content - The new content to store.
   * @returns The updated `CacheResource`.
   */
  update(content: unknown): CacheResource {
    resource = { content, version: resource.version + 1, updatedAt: new Date().toISOString() };
    return resource;
  },

  /**
   * Restores the resource to its fixed seed content/version/timestamp.
   */
  reset(): void {
    resource = { content: SEED_CONTENT, version: 1, updatedAt: SEED_UPDATED_AT };
  },
};
