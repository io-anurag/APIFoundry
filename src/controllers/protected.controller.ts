import type { Request, Response } from "express";

export function getProtected(req: Request, res: Response): void {
  res.status(200).json({ granted: true, role: req.auth!.role });
}
