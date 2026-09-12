import { createInMemoryStore } from "./inMemoryStore";
import type { Customer } from "../models/customer";
import { userStore } from "./users.seed";

export const customerStore = createInMemoryStore<Customer>();

const CUSTOMER_COUNT = 60;
const COUNTRIES = ["USA", "Canada", "UK", "Germany", "France", "Australia"];

/**
 * Builds `CUSTOMER_COUNT` deterministic seed customers, cycling through `COUNTRIES` for address
 * data and linking every third customer to an existing seeded user (never a non-existent one).
 *
 * @returns The complete array of seed `Customer` records.
 */
function buildSeedCustomers(): Customer[] {
  const now = new Date().toISOString();
  const userCount = userStore.list().length;
  const customers: Customer[] = [];

  for (let i = 1; i <= CUSTOMER_COUNT; i++) {
    const country = COUNTRIES[(i - 1) % COUNTRIES.length];
    // Link every third customer to an existing seeded user (ids 1..userCount); never reference an id
    // that doesn't exist in the user store, even in seed data.
    const userId = i % 3 === 0 && i <= userCount ? i : null;

    customers.push({
      id: i,
      name: `Customer ${i}`,
      email: `customer${i}@example.com`,
      address: {
        street: `${100 + i} Main St`,
        city: `City ${i}`,
        postalCode: String(10000 + i),
        country,
      },
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return customers;
}

/** Deterministically (re)populates the customer store — FR-002/FR-003. Also used by tests to reset state. */
export function seedCustomers(): void {
  customerStore.reset(buildSeedCustomers());
}

seedCustomers();
