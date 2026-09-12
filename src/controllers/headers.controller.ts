import type { Request, Response } from "express";
import * as headersService from "../services/headers.service";

/**
 * Handles `GET /headers`: echoes every incoming request header except `Authorization`, `Cookie`,
 * and `X-API-Key`.
 *
 * @param req - The incoming request; its headers are read and filtered.
 * @param res - Used to send the `{ headers }` response.
 */
export function getHeaders(req: Request, res: Response): void {
  res.status(200).json({ headers: headersService.getSafeHeaders(req) });
}
