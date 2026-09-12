import { resetDataStores, resetAuthStores } from "../../src/services/admin.service";

/**
 * Restores every in-memory store to its deterministic seeded state. Call from `beforeEach` in every
 * test file that mutates a store, since Vitest keeps one module registry per test file (state
 * otherwise leaks between `it()` blocks in the same file). Delegates to the same
 * `resetDataStores`/`resetAuthStores` functions the `/admin/reset`/`/admin/auth/reset` endpoints
 * call (Spec 011), so test-time reset and production admin-reset can never drift apart.
 */
export function resetStores(): void {
  resetDataStores();
  resetAuthStores();
}
