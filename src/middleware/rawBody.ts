/**
 * Augments Express's `Request` with an optional `rawBody` buffer, populated by `captureRawBody`
 * when passed as `express.json()`'s `verify` option. Exists so downstream code (the payload-echo
 * endpoint) can report the exact byte length of a request body as transmitted, without
 * re-serializing the already-parsed JSON value (research.md Decision 2 for Spec 007).
 */
import type { Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

/**
 * `express.json()` `verify` callback: stashes the exact raw request-body bytes on `req.rawBody`
 * before JSON parsing occurs. Never throws — a malformed body still reaches JSON parsing (and its
 * own error handling) unaffected; this only records the bytes seen.
 *
 * @param req - The in-flight request; mutated to carry `rawBody`.
 * @param _res - Unused; required by `express.json()`'s `verify` signature.
 * @param buf - The raw request body bytes captured before parsing.
 */
export function captureRawBody(req: Request, _res: Response, buf: Buffer): void {
  req.rawBody = buf;
}
