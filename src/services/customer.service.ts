import { customerStore } from "../data/customers.seed";
import { userStore } from "../data/users.seed";
import { customerCreateSchema, customerPatchSchema, type Customer } from "../models/customer";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "name", "email", "createdAt"] as const;

function assertEmailUnique(email: string, excludeId?: number): void {
  const conflict = customerStore.list().find((customer) => customer.email === email && customer.id !== excludeId);
  if (conflict) {
    throw new HttpError(400, "VALIDATION_ERROR", `email '${email}' is already in use.`, { field: "email" });
  }
}

function assertUserExists(userId: number | null | undefined): void {
  if (userId === null || userId === undefined) return;
  if (!userStore.get(userId)) {
    throw new HttpError(400, "VALIDATION_ERROR", `userId ${userId} does not reference an existing user.`, {
      field: "userId",
      value: userId,
    });
  }
}

export function listCustomers(
  rawQuery: Record<string, unknown>
): ListQueryResult<Customer> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const country = lastQueryValue(rawQuery.country);
  const filters = country ? [(customer: Customer) => customer.address.country === country] : [];
  const { data, total } = applyListQuery(customerStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

export function getCustomer(id: number): Customer {
  const customer = customerStore.get(id);
  if (!customer) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Customer ${id} not found.`);
  return customer;
}

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

export function patchCustomer(id: number, rawBody: unknown): Customer {
  const input = customerPatchSchema.parse(rawBody);
  if (input.email) assertEmailUnique(input.email, id);
  if ("userId" in input) assertUserExists(input.userId);

  const updated = customerStore.patch(id, { ...input, updatedAt: new Date().toISOString() });
  if (!updated) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Customer ${id} not found.`);
  return updated;
}

export function deleteCustomer(id: number): void {
  if (!customerStore.remove(id)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Customer ${id} not found.`);
  }
}
