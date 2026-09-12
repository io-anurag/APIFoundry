import type { Request, Response } from "express";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as searchService from "../services/search.service";

/**
 * Handles `GET /api/v1/search`: runs a cross-resource search via `searchService.search` using the
 * `q` (and pagination) query parameters, responding `200` with a paginated envelope built by
 * `buildPaginationEnvelope`, including the empty/no-result case.
 * @param req - Express request; reads the `q` search term and pagination options from `req.query`.
 * @param res - Express response.
 */
export function search(req: Request, res: Response): void {
  const { data, page, limit, total } = searchService.search(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}
