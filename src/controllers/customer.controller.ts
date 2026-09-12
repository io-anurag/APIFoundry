import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as customerService from "../services/customer.service";

/**
 * Handles `GET /customers`: lists customers via `customerService.listCustomers`, applying the
 * pagination/sort/filter options in the query string, and responds `200` with a paginated
 * envelope built by `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listCustomers(req: Request, res: Response): void {
  const { data, page, limit, total } = customerService.listCustomers(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /customers/:id`: parses the `id` path param via `parseIdParam` and looks up the
 * customer via `customerService.getCustomer`, responding `200` with the customer.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getCustomerById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  res.status(200).json(customerService.getCustomer(id));
}

/**
 * Handles `POST /customers`: creates a new customer from the request body via
 * `customerService.createCustomer`, responding `201` with the created customer.
 * @param req - Express request; body carries the new customer's fields.
 * @param res - Express response.
 */
export function createCustomer(req: Request, res: Response): void {
  res.status(201).json(customerService.createCustomer(req.body));
}

/**
 * Handles `PUT /customers/:id`: parses the `id` path param via `parseIdParam` and fully replaces
 * the customer with the request body via `customerService.replaceCustomer`, responding `200` with
 * the replaced customer.
 * @param req - Express request; reads the `id` path parameter and the replacement body.
 * @param res - Express response.
 */
export function replaceCustomer(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  res.status(200).json(customerService.replaceCustomer(id, req.body));
}

/**
 * Handles `PATCH /customers/:id`: parses the `id` path param via `parseIdParam` and applies a
 * partial update from the request body via `customerService.patchCustomer`, responding `200` with
 * the updated customer.
 * @param req - Express request; reads the `id` path parameter and the partial update body.
 * @param res - Express response.
 */
export function patchCustomer(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  res.status(200).json(customerService.patchCustomer(id, req.body));
}

/**
 * Handles `DELETE /customers/:id`: parses the `id` path param via `parseIdParam`, deletes the
 * customer via `customerService.deleteCustomer`, and responds `204` with no body.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function deleteCustomer(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "customer");
  customerService.deleteCustomer(id);
  res.status(204).send();
}
