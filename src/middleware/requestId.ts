import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * pino-http's typings already declare `req.id: ReqId` (string | number | object) on the shared
 * http.IncomingMessage interface; we always assign a string at runtime (crypto.randomUUID()), so
 * this helper narrows it back to `string` for callers instead of redeclaring `id` (which would
 * conflict with pino-http's ambient type on Express.Request's multiple-inheritance chain).
 */
export function requestIdOf(req: Request): string {
  return String(req.id);
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
}
