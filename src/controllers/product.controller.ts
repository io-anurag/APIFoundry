import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as productService from "../services/product.service";

export function listProducts(req: Request, res: Response): void {
  const { data, page, limit, total } = productService.listProducts(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getProductById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  res.status(200).json(productService.getProduct(id));
}

export function createProduct(req: Request, res: Response): void {
  res.status(201).json(productService.createProduct(req.body));
}

export function replaceProduct(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  res.status(200).json(productService.replaceProduct(id, req.body));
}

export function patchProduct(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  res.status(200).json(productService.patchProduct(id, req.body));
}

export function deleteProduct(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "product");
  productService.deleteProduct(id);
  res.status(204).send();
}
