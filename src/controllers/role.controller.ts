import type { Request, Response } from "express";

/**
 * Handles `GET /api/v1/role/:role`: demonstrates role-gated access for the role named in the
 * path. Reachable only after the route's own `validateRoleParam` / `authenticate` /
 * `requireMatchingRole` middleware chain passes, so `granted` is always true here; responds `200`
 * with the requested role and the granted flag.
 * @param req - Express request; reads the `role` path parameter.
 * @param res - Express response.
 */
export function getRoleDemo(req: Request, res: Response): void {
  res.status(200).json({ role: req.params.role, granted: true });
}
