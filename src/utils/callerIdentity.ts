import type { Request } from "express";

/**
 * Resolves the identity used to scope per-caller rate-limit counters: the `X-API-Key` header
 * value when present and non-empty, otherwise the request's IP address (spec.md Assumptions —
 * `GET /rate-limit` itself requires no authentication).
 *
 * @param req - The incoming request.
 * @returns The caller identity string used as the rate-limit counter's key.
 */
export function resolveCallerIdentity(req: Request): string {
  const apiKey = req.header("X-API-Key");
  return apiKey && apiKey.length > 0 ? apiKey : (req.ip ?? "unknown");
}
