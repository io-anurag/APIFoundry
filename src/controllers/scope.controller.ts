import type { Request, Response } from "express";

/** Reachable only after the route's own scope check passes, so `granted` is always true here. */
export function getScopeDemo(req: Request, res: Response): void {
  res.status(200).json({ scope: req.params.scope, granted: true });
}
