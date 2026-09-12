import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * pino-http's typings already declare `req.id: ReqId` (string | number | object) on the shared
 * http.IncomingMessage interface; we always assign a string at runtime (crypto.randomUUID()), so
 * this helper narrows it back to `string` for callers instead of redeclaring `id` (which would
 * conflict with pino-http's ambient type on Express.Request's multiple-inheritance chain).
 *
 * @param req - The Express request whose `id` was previously set by the `requestId` middleware.
 * @returns The request id as a string.
 */
export function requestIdOf(req: Request): string {
  return String(req.id);
}

/**
 * Assigns a fresh UUID as the request's id, stamps it on `req.id`, and echoes it back on the
 * response as the `X-Request-ID` header. Always succeeds and calls `next()`; has no failure path.
 *
 * @param req - The incoming Express request; receives the generated id on `req.id`.
 * @param res - The Express response; receives the `X-Request-ID` header.
 * @param next - Express callback, always invoked with no argument to continue.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  req.id = id;
  res.setHeader("X-Request-ID", id);
  next();
}
