import type { Request, Response } from "express";
import { parseUuidParam } from "../utils/uuidParam";
import { parseDateParam } from "../utils/dateParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as paymentService from "../services/payment.service";

export function listPayments(req: Request, res: Response): void {
  const { data, page, limit, total } = paymentService.listPayments(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getPaymentById(req: Request, res: Response): void {
  const id = parseUuidParam(req.params.id, "payment");
  res.status(200).json(paymentService.getPaymentById(id));
}

export function listPaymentsByDate(req: Request, res: Response): void {
  const date = parseDateParam(req.params.date);
  const { data, page, limit, total } = paymentService.listPaymentsByDate(
    date,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}
