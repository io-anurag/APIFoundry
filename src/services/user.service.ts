import { userStore } from "../data/users.seed";
import { userCreateSchema, userPatchSchema, type User } from "../models/user";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "email", "role", "status", "createdAt"] as const;

function assertEmailUnique(email: string, excludeId?: number): void {
  const conflict = userStore.list().find((user) => user.email === email && user.id !== excludeId);
  if (conflict) {
    throw new HttpError(400, "VALIDATION_ERROR", `email '${email}' is already in use.`, { field: "email" });
  }
}

export function listUsers(rawQuery: Record<string, unknown>): ListQueryResult<User> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const role = lastQueryValue(rawQuery.role);
  const filters = role ? [(user: User) => user.role === role] : [];
  const { data, total } = applyListQuery(userStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

export function getUser(id: number): User {
  const user = userStore.get(id);
  if (!user) throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${id} not found.`);
  return user;
}

export function createUser(rawBody: unknown): User {
  const input = userCreateSchema.parse(rawBody);
  assertEmailUnique(input.email);

  const now = new Date().toISOString();
  return userStore.create((id) => ({
    id,
    name: input.name,
    email: input.email,
    role: input.role,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  }));
}

export function replaceUser(id: number, rawBody: unknown): User {
  const input = userCreateSchema.parse(rawBody);
  assertEmailUnique(input.email, id);

  const updated = userStore.replace(id, (existing) => ({
    ...existing,
    name: input.name,
    email: input.email,
    role: input.role,
    status: input.status ?? "active",
    updatedAt: new Date().toISOString(),
  }));
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${id} not found.`);
  return updated;
}

export function patchUser(id: number, rawBody: unknown): User {
  const input = userPatchSchema.parse(rawBody);
  if (input.email) assertEmailUnique(input.email, id);

  const updated = userStore.patch(id, { ...input, updatedAt: new Date().toISOString() });
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${id} not found.`);
  return updated;
}

export function deleteUser(id: number): void {
  if (!userStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${id} not found.`);
  }
}
