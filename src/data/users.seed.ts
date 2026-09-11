import { createInMemoryStore } from "./inMemoryStore";
import type { User } from "../models/user";
import { USER_ROLES } from "../models/enums";

export const userStore = createInMemoryStore<User>();

const USER_COUNT = 50;

function buildSeedUsers(): User[] {
  const now = new Date().toISOString();
  const users: User[] = [];

  for (let i = 1; i <= USER_COUNT; i++) {
    users.push({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      role: USER_ROLES[(i - 1) % USER_ROLES.length],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  return users;
}

/** Deterministically (re)populates the user store — FR-002/FR-003. Also used by tests to reset state. */
export function seedUsers(): void {
  userStore.reset(buildSeedUsers());
}

seedUsers();
