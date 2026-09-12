import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as orderService from "../services/order.service";

/**
 * Handles `GET /orders`: lists orders via `orderService.listOrders`, applying the pagination/
 * sort/filter options in the query string, and responds `200` with a paginated envelope built by
 * `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listOrders(req: Request, res: Response): void {
  const { data, page, limit, total } = orderService.listOrders(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /orders/:id`: parses the `id` path param via `parseIdParam` and looks up the order
 * via `orderService.getOrder`, responding `200` with the order.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getOrderById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  res.status(200).json(orderService.getOrder(id));
}

/**
 * Handles `POST /orders`: creates a new order from the request body via
 * `orderService.createOrder`, responding `201` with the created order.
 * @param req - Express request; body carries the new order's fields.
 * @param res - Express response.
 */
export function createOrder(req: Request, res: Response): void {
  res.status(201).json(orderService.createOrder(req.body));
}

/**
 * Handles `PUT /orders/:id`: parses the `id` path param via `parseIdParam` and fully replaces the
 * order with the request body via `orderService.replaceOrder`, responding `200` with the replaced
 * order.
 * @param req - Express request; reads the `id` path parameter and the replacement body.
 * @param res - Express response.
 */
export function replaceOrder(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  res.status(200).json(orderService.replaceOrder(id, req.body));
}

/**
 * Handles `PATCH /orders/:id`: parses the `id` path param via `parseIdParam` and applies a
 * partial update from the request body via `orderService.patchOrder`, responding `200` with the
 * updated order.
 * @param req - Express request; reads the `id` path parameter and the partial update body.
 * @param res - Express response.
 */
export function patchOrder(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  res.status(200).json(orderService.patchOrder(id, req.body));
}

/**
 * Handles `DELETE /orders/:id`: parses the `id` path param via `parseIdParam`, deletes the order
 * via `orderService.deleteOrder`, and responds `204` with no body.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function deleteOrder(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  orderService.deleteOrder(id);
  res.status(204).send();
}

/**
 * Handles `GET /users/:id/orders`: parses the user `id` path param via `parseIdParam` and lists
 * that user's orders via `orderService.listOrdersForUser`, applying pagination/sort/filter
 * options from the query string, responding `200` with a paginated envelope.
 * @param req - Express request; reads the user `id` path parameter and query options.
 * @param res - Express response.
 */
export function getOrdersForUser(req: Request, res: Response): void {
  const userId = parseIdParam(req.params.id, "user");
  const { data, page, limit, total } = orderService.listOrdersForUser(
    userId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /orders/:id/products`: parses the order `id` path param via `parseIdParam` and
 * lists that order's line-item products via `orderService.listProductsForOrder`, applying
 * pagination/sort/filter options from the query string, responding `200` with a paginated
 * envelope.
 * @param req - Express request; reads the order `id` path parameter and query options.
 * @param res - Express response.
 */
export function getProductsForOrder(req: Request, res: Response): void {
  const orderId = parseIdParam(req.params.id, "order");
  const { data, page, limit, total } = orderService.listProductsForOrder(
    orderId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}
