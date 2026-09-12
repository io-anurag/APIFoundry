import type { Request, Response } from "express";

export function getBasicAuthDemo(req: Request, res: Response): void {
  res.status(200).json({ authenticated: true, username: req.basicAuthUser!.username });
}
