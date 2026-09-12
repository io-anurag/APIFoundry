import type { Request } from "express";
import { config } from "../config";
import { parseDelayMsParam } from "../utils/delayMsParam";

/**
 * Resolves and validates the requested delay for a `/delay` request, reading the value from
 * either the `:ms` path segment or the `?ms=` query parameter (whichever the matched route
 * supplies), bounded by `config.maxDelayMs`.
 *
 * @param req - The incoming request; exactly one of `req.params.ms`/`req.query.ms` is populated
 *   depending on which `/delay` route matched.
 * @returns The validated delay in milliseconds.
 */
export function resolveDelayMs(req: Request): number {
  const raw = req.params.ms ?? req.query.ms;
  return parseDelayMsParam(raw, config.maxDelayMs);
}
