import type { Request, Response } from "express";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as searchService from "../services/search.service";

export function search(req: Request, res: Response): void {
  const { data, page, limit, total } = searchService.search(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}
