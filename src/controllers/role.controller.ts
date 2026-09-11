import type { Request, Response } from "express";

/** Reachable only after the route's own role check passes, so `granted` is always true here. */
export function getRoleDemo(req: Request, res: Response): void {
  res.status(200).json({ role: req.params.role, granted: true });
}
