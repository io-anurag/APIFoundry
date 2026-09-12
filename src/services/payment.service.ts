import { paymentStore } from "../data/payments.seed";
import type { Payment } from "../models/payment";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "orderId", "status", "processedAt", "createdAt"] as const;

/**
 * Lists payments with pagination/sorting, optionally filtered to a single `status`.
 *
 * @param rawQuery - Raw query-string parameters (page, limit, sort, status, etc.).
 * @returns The matching page of payments plus the total count, page, and limit used.
 */
export function listPayments(
  rawQuery: Record<string, unknown>
): ListQueryResult<Payment> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const status = lastQueryValue(rawQuery.status);
  const filters = status ? [(payment: Payment) => payment.status === status] : [];
  const { data, total } = applyListQuery(paymentStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Looks up a single payment by id.
 *
 * @param id - The payment id to look up.
 * @returns The matching payment.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no payment has that id.
 */
export function getPaymentById(id: string): Payment {
  const payment = paymentStore.get(id);
  if (!payment) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Payment ${id} not found.`);
  return payment;
}

/**
 * Lists payments processed on a given calendar date (payments/by-date/:date, FR-007).
 *
 * @param date - The calendar date (matched against each payment's `processedAt`) to filter by.
 * @param rawQuery - Raw query-string parameters (page, limit, sort, etc.).
 * @returns The matching page of payments plus the total count, page, and limit used.
 */
export function listPaymentsByDate(
  date: string,
  rawQuery: Record<string, unknown>
): ListQueryResult<Payment> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(paymentStore.list(), query, {
    filters: [(payment: Payment) => payment.processedAt === date],
  });
  return { data, total, page: query.page, limit: query.limit };
}
