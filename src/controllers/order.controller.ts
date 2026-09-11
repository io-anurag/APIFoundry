import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as orderService from "../services/order.service";

export function listOrders(req: Request, res: Response): void {
  const { data, page, limit, total } = orderService.listOrders(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getOrderById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  res.status(200).json(orderService.getOrder(id));
}

export function createOrder(req: Request, res: Response): void {
  res.status(201).json(orderService.createOrder(req.body));
}

export function replaceOrder(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  res.status(200).json(orderService.replaceOrder(id, req.body));
}

export function patchOrder(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  res.status(200).json(orderService.patchOrder(id, req.body));
}

export function deleteOrder(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "order");
  orderService.deleteOrder(id);
  res.status(204).send();
}

export function getOrdersForUser(req: Request, res: Response): void {
  const userId = parseIdParam(req.params.id, "user");
  const { data, page, limit, total } = orderService.listOrdersForUser(
    userId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getProductsForOrder(req: Request, res: Response): void {
  const orderId = parseIdParam(req.params.id, "order");
  const { data, page, limit, total } = orderService.listProductsForOrder(
    orderId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}
