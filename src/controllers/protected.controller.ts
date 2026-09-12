import type { Request, Response } from "express";

/**
 * Handles `GET /api/v1/protected`: reachable only after the `authenticate` and
 * `requireRole("admin")` middleware have already passed, so `granted` is always true here.
 * Responds `200` with the granted flag and the authenticated principal's role, demonstrating the
 * `401` (unauthenticated) vs `403` (wrong role) distinction that the guarding middleware enforces
 * upstream.
 * @param req - Express request; expects `req.auth` set by `authenticate`.
 * @param res - Express response.
 */
export function getProtected(req: Request, res: Response): void {
  res.status(200).json({ granted: true, role: req.auth!.role });
}
