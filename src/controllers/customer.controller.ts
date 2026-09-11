import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as customerService from "../services/customer.service";

export function listCustomers(req: Request, res: Response): void {
  const { data, page, limit, total } = customerService.listCustomers(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getCustomerById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  res.status(200).json(customerService.getCustomer(id));
}

export function createCustomer(req: Request, res: Response): void {
  res.status(201).json(customerService.createCustomer(req.body));
}

export function replaceCustomer(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  res.status(200).json(customerService.replaceCustomer(id, req.body));
}

export function patchCustomer(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  res.status(200).json(customerService.patchCustomer(id, req.body));
}

export function deleteCustomer(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  customerService.deleteCustomer(id);
  res.status(204).send();
}
