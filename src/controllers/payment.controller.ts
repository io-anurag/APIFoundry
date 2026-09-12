import type { Request, Response } from "express";
import { parseUuidParam } from "../utils/uuidParam";
import { parseDateParam } from "../utils/dateParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as paymentService from "../services/payment.service";
import { createPaymentRequestSchema } from "../models/paymentRequests";
import { HttpError } from "../utils/httpError";

/**
 * Handles `GET /payments`: lists payments via `paymentService.listPayments`, applying the
 * pagination/sort/filter options in the query string, and responds `200` with a paginated
 * envelope built by `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listPayments(req: Request, res: Response): void {
  const { data, page, limit, total } = paymentService.listPayments(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /payments/:id`: parses the `id` path param via `parseUuidParam` and looks up the
 * payment via `paymentService.getPaymentById`, responding `200` with the payment.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getPaymentById(req: Request, res: Response): void {
  const id = parseUuidParam(req.params.id, "payment");
  res.status(200).json(paymentService.getPaymentById(id));
}

/**
 * Handles `GET /payments/by-date/:date`: parses the `date` path param via `parseDateParam` and
 * lists payments made on that date via `paymentService.listPaymentsByDate`, applying pagination/
 * sort/filter options from the query string, responding `200` with a paginated envelope.
 * @param req - Express request; reads the `date` path parameter and query options.
 * @param res - Express response.
 */
export function listPaymentsByDate(req: Request, res: Response): void {
  const date = parseDateParam(req.params.date);
  const { data, page, limit, total } = paymentService.listPaymentsByDate(
    date,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `POST /payments`: requires an `Idempotency-Key` header, validates the request body,
 * and creates (or replays) a payment via `paymentService.createPaymentIdempotently`, responding
 * with whichever status code that returns (`201` new, `200` replayed).
 * @param req - Express request; reads the `Idempotency-Key` header and the JSON body.
 * @param res - Express response.
 */
export function postPayment(req: Request, res: Response): void {
  const idempotencyKey = req.header("Idempotency-Key");
  if (!idempotencyKey) {
    throw new HttpError(400, "VALIDATION_ERROR", "Idempotency-Key header is required.");
  }

  const body = createPaymentRequestSchema.parse(req.body);
  const { statusCode, payment } = paymentService.createPaymentIdempotently(idempotencyKey, body);
  res.status(statusCode).json(payment);
}
