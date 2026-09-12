import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as productService from "../services/product.service";

/**
 * Handles `GET /products`: lists products via `productService.listProducts`, applying the
 * pagination/sort/filter options in the query string, and responds `200` with a paginated
 * envelope built by `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listProducts(req: Request, res: Response): void {
  const { data, page, limit, total } = productService.listProducts(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /products/:id`: parses the `id` path param via `parseIdParam` and looks up the
 * product via `productService.getProduct`, responding `200` with the product.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getProductById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  res.status(200).json(productService.getProduct(id));
}

/**
 * Handles `POST /products`: creates a new product from the request body via
 * `productService.createProduct`, responding `201` with the created product.
 * @param req - Express request; body carries the new product's fields.
 * @param res - Express response.
 */
export function createProduct(req: Request, res: Response): void {
  res.status(201).json(productService.createProduct(req.body));
}

/**
 * Handles `PUT /products/:id`: parses the `id` path param via `parseIdParam` and fully replaces
 * the product with the request body via `productService.replaceProduct`, responding `200` with
 * the replaced product.
 * @param req - Express request; reads the `id` path parameter and the replacement body.
 * @param res - Express response.
 */
export function replaceProduct(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  res.status(200).json(productService.replaceProduct(id, req.body));
}

/**
 * Handles `PATCH /products/:id`: parses the `id` path param via `parseIdParam` and applies a
 * partial update from the request body via `productService.patchProduct`, responding `200` with
 * the updated product.
 * @param req - Express request; reads the `id` path parameter and the partial update body.
 * @param res - Express response.
 */
export function patchProduct(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  res.status(200).json(productService.patchProduct(id, req.body));
}

/**
 * Handles `DELETE /products/:id`: parses the `id` path param via `parseIdParam`, deletes the
 * product via `productService.deleteProduct`, and responds `204` with no body.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function deleteProduct(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  productService.deleteProduct(id);
  res.status(204).send();
}
