import { customerStore } from "../data/customers.seed";
import { userStore } from "../data/users.seed";
import { customerCreateSchema, customerPatchSchema, type Customer } from "../models/customer";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "email", "createdAt"] as const;

/**
 * Ensures no other customer already uses the given email.
 *
 * @param email - The email to check.
 * @param excludeId - A customer id to exclude from the conflict check (the record being updated).
 * @throws HttpError 400 VALIDATION_ERROR if another customer already has this email.
 */
function assertEmailUnique(email: string, excludeId?: number): void {
  const conflict = customerStore.list().find((customer) => customer.email === email && customer.id !== excludeId);
  if (conflict) {
    throw new HttpError(400, "VALIDATION_ERROR", `email '${email}' is already in use.`, { field: "email" });
  }
}

/**
 * Ensures `userId`, when provided, references an existing user.
 *
 * @param userId - The user id to check, or `null`/`undefined` to skip the check.
 * @throws HttpError 400 VALIDATION_ERROR if `userId` is set but no matching user exists.
 */
function assertUserExists(userId: number | null | undefined): void {
  if (userId === null || userId === undefined) return;
  if (!userStore.get(userId)) {
    throw new HttpError(400, "VALIDATION_ERROR", `userId ${userId} does not reference an existing user.`, {
      field: "userId",
      value: userId,
    });
  }
}

/**
 * Lists customers with pagination/sorting, optionally filtered to a single `country`.
 *
 * @param rawQuery - Raw query-string parameters (page, limit, sort, country, etc.).
 * @returns The matching page of customers plus the total count, page, and limit used.
 */
export function listCustomers(
  rawQuery: Record<string, unknown>
): ListQueryResult<Customer> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const country = lastQueryValue(rawQuery.country);
  const filters = country ? [(customer: Customer) => customer.address.country === country] : [];
  const { data, total } = applyListQuery(customerStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Looks up a single customer by id.
 *
 * @param id - The customer id to look up.
 * @returns The matching customer.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no customer has that id.
 */
export function getCustomer(id: number): Customer {
  const customer = customerStore.get(id);
  if (!customer) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Customer ${id} not found.`);
  return customer;
}

/**
 * Validates and creates a new customer.
 *
 * @param rawBody - Request body validated against `customerCreateSchema`.
 * @returns The newly created customer record.
 * @throws HttpError 400 VALIDATION_ERROR if the email is already in use by another customer, or if `userId` is set but does not reference an existing user.
 */
export function createCustomer(rawBody: unknown): Customer {
  const input = customerCreateSchema.parse(rawBody);
  assertEmailUnique(input.email);
  assertUserExists(input.userId);

  const now = new Date().toISOString();
  return customerStore.create((id) => ({
    id,
    name: input.name,
    email: input.email,
    address: input.address,
    userId: input.userId ?? null,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Fully replaces an existing customer's fields.
 *
 * @param id - The id of the customer to replace.
 * @param rawBody - Request body validated against `customerCreateSchema`.
 * @returns The updated customer record.
 * @throws HttpError 400 VALIDATION_ERROR if the email is already in use by another customer, or if `userId` is set but does not reference an existing user.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no customer has that id.
 */
export function replaceCustomer(id: number, rawBody: unknown): Customer {
  const input = customerCreateSchema.parse(rawBody);
  assertEmailUnique(input.email, id);
  assertUserExists(input.userId);

  const updated = customerStore.replace(id, (existing) => ({
    ...existing,
    name: input.name,
    email: input.email,
    address: input.address,
    userId: input.userId ?? null,
    updatedAt: new Date().toISOString(),
  }));
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Customer ${id} not found.`);
  return updated;
}

/**
 * Partially updates an existing customer's fields.
 *
 * @param id - The id of the customer to update.
 * @param rawBody - Request body validated against `customerPatchSchema`; only present fields are applied.
 * @returns The updated customer record.
 * @throws HttpError 400 VALIDATION_ERROR if a new email is already in use by another customer, or if `userId` is set but does not reference an existing user.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no customer has that id.
 */
export function patchCustomer(id: number, rawBody: unknown): Customer {
  const input = customerPatchSchema.parse(rawBody);
  if (input.email) assertEmailUnique(input.email, id);
  if ("userId" in input) assertUserExists(input.userId);

  const updated = customerStore.patch(id, { ...input, updatedAt: new Date().toISOString() });
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Customer ${id} not found.`);
  return updated;
}

/**
 * Deletes a customer by id.
 *
 * @param id - The id of the customer to delete.
 * @returns Nothing.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no customer has that id.
 */
export function deleteCustomer(id: number): void {
  if (!customerStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Customer ${id} not found.`);
  }
}
