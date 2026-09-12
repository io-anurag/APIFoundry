import type { Request } from "express";

/**
 * Header names never echoed by `GET /headers`, since they may carry credentials. Node.js already
 * lowercases incoming header names, so a direct lowercase-key match suffices (data-model.md).
 */
const SENSITIVE_HEADER_NAMES = ["authorization", "cookie", "x-api-key"] as const;

/**
 * Returns every incoming request header except the sensitive ones (FR-013): `Authorization`,
 * `Cookie`, and `X-API-Key` are always excluded, regardless of case.
 *
 * @param req - The incoming request; its headers are filtered.
 * @returns A plain object of every safe header name to its value(s).
 */
export function getSafeHeaders(req: Request): Record<string, string | string[]> {
  const safeHeaders: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if ((SENSITIVE_HEADER_NAMES as readonly string[]).includes(name)) continue;
    if (value === undefined) continue;
    safeHeaders[name] = value;
  }
  return safeHeaders;
}
