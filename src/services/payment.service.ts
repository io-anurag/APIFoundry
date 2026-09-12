import { randomUUID } from "node:crypto";
import { paymentStore } from "../data/payments.seed";
import type { Payment } from "../models/payment";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";
import { idempotencyStore } from "../data/idempotency.store";
import { hashRequestBody } from "../utils/canonicalJson";
import type { CreatePaymentRequest } from "../models/paymentRequests";

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

/**
 * Creates a payment honoring `Idempotency-Key` semantics: a fresh key creates exactly one new
 * payment; the same key reused with an identical (canonicalized) body replays the original
 * result; the same key reused with a different body is rejected as a conflict. This whole
 * check-then-write path is synchronous (no `await`), so concurrent requests sharing a fresh key
 * cannot interleave (research.md Decision 4, FR-014).
 *
 * @param idempotencyKey - The caller-supplied `Idempotency-Key` header value.
 * @param body - The validated request body.
 * @returns The status code to respond with (`201` for a new payment, `200` for a replayed one)
 *   and the resulting payment.
 * @throws HttpError 409 IDEMPOTENCY_KEY_CONFLICT if the key was already used with a different body.
 */
export function createPaymentIdempotently(
  idempotencyKey: string,
  body: CreatePaymentRequest
): { statusCode: 200 | 201; payment: Payment } {
  const requestHash = hashRequestBody(body);
  const existing = idempotencyStore.get(idempotencyKey);

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(
        409,
        "IDEMPOTENCY_KEY_CONFLICT",
        "This Idempotency-Key was already used with a different request body."
      );
    }
    return { statusCode: 200, payment: existing.payment };
  }

  const payment: Payment = {
    id: randomUUID(),
    orderId: body.orderId,
    amount: body.amount,
    status: body.status,
    processedAt: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };

  paymentStore.create(payment);
  idempotencyStore.create({ id: idempotencyKey, requestHash, statusCode: 201, payment });

  return { statusCode: 201, payment };
}
