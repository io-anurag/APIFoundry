import { paymentStore } from "../data/payments.seed";
import type { Payment } from "../models/payment";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "orderId", "status", "processedAt", "createdAt"] as const;

export function listPayments(
  rawQuery: Record<string, unknown>
): ListQueryResult<Payment> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const status = lastQueryValue(rawQuery.status);
  const filters = status ? [(payment: Payment) => payment.status === status] : [];
  const { data, total } = applyListQuery(paymentStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

export function getPaymentById(id: string): Payment {
  const payment = paymentStore.get(id);
  if (!payment) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Payment ${id} not found.`);
  return payment;
}

/** Lists payments processed on a given calendar date (payments/by-date/:date, FR-007). */
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
