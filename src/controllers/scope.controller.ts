import type { Request, Response } from "express";

/**
 * Handles `GET /api/v1/scope/:scope`: demonstrates scope-gated access for the OAuth-style scope
 * named in the path. Reachable only after the route's own `validateScopeParam` / `authenticate` /
 * `requireMatchingScope` middleware chain passes, so `granted` is always true here; responds `200`
 * with the requested scope and the granted flag.
 * @param req - Express request; reads the `scope` path parameter.
 * @param res - Express response.
 */
export function getScopeDemo(req: Request, res: Response): void {
  res.status(200).json({ scope: req.params.scope, granted: true });
}
