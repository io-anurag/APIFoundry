import type { Request, Response } from "express";
import { listRoutes } from "../services/routeRegistry.service";

/**
 * Handles `GET /api/v1/routes`: responds `200` with every implemented route's method, path,
 * description, and auth requirement. No input to validate, no error path.
 * @param _req - Express request (unused).
 * @param res - Express response.
 */
export function getRoutes(_req: Request, res: Response): void {
  res.status(200).json({ data: listRoutes() });
}
