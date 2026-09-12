import { userStore } from "../data/users.seed";
import { userCreateSchema, userPatchSchema, type User } from "../models/user";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "email", "role", "status", "createdAt"] as const;

/**
 * Ensures no other user already uses the given email.
 *
 * @param email - The email to check.
 * @param excludeId - A user id to exclude from the conflict check (the record being updated).
 * @throws HttpError 400 VALIDATION_ERROR if another user already has this email.
 */
function assertEmailUnique(email: string, excludeId?: number): void {
  const conflict = userStore.list().find((user) => user.email === email && user.id !== excludeId);
  if (conflict) {
    throw new HttpError(400, "VALIDATION_ERROR", `email '${email}' is already in use.`, { field: "email" });
  }
}

/**
 * Lists users with pagination/sorting, optionally filtered to a single `role`.
 *
 * @param rawQuery - Raw query-string parameters (page, limit, sort, role, etc.).
 * @returns The matching page of users plus the total count, page, and limit used.
 */
export function listUsers(rawQuery: Record<string, unknown>): ListQueryResult<User> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const role = lastQueryValue(rawQuery.role);
  const filters = role ? [(user: User) => user.role === role] : [];
  const { data, total } = applyListQuery(userStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Looks up a single user by id.
 *
 * @param id - The user id to look up.
 * @returns The matching user.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no user has that id.
 */
export function getUser(id: number): User {
  const user = userStore.get(id);
  if (!user) throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${id} not found.`);
  return user;
}

/**
 * Validates and creates a new user.
 *
 * @param rawBody - Request body validated against `userCreateSchema`.
 * @returns The newly created user record.
 * @throws HttpError 400 VALIDATION_ERROR if the email is already in use by another user.
 */
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

/**
 * Fully replaces an existing user's fields.
 *
 * @param id - The id of the user to replace.
 * @param rawBody - Request body validated against `userCreateSchema`.
 * @returns The updated user record.
 * @throws HttpError 400 VALIDATION_ERROR if the email is already in use by another user.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no user has that id.
 */
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

/**
 * Partially updates an existing user's fields.
 *
 * @param id - The id of the user to update.
 * @param rawBody - Request body validated against `userPatchSchema`; only present fields are applied.
 * @returns The updated user record.
 * @throws HttpError 400 VALIDATION_ERROR if a new email is already in use by another user.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no user has that id.
 */
export function patchUser(id: number, rawBody: unknown): User {
  const input = userPatchSchema.parse(rawBody);
  if (input.email) assertEmailUnique(input.email, id);

  const updated = userStore.patch(id, { ...input, updatedAt: new Date().toISOString() });
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${id} not found.`);
  return updated;
}

/**
 * Deletes a user by id.
 *
 * @param id - The id of the user to delete.
 * @returns Nothing.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no user has that id.
 */
export function deleteUser(id: number): void {
  if (!userStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${id} not found.`);
  }
}
