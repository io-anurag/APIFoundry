import type { Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { parseCookieHeader } from "../utils/cookieHeader";

/**
 * Reports every cookie present on the incoming request (`GET /cookies`), parsed from the raw
 * `Cookie` header — this feature keeps no server-side registry of its own; the client's resent
 * header is the only source of truth (data-model.md).
 *
 * @param req - The incoming request; its `Cookie` header is parsed.
 * @returns A plain name/value map of every cookie present.
 */
export function listCookies(req: Request): Record<string, string> {
  return parseCookieHeader(req.headers.cookie);
}

/**
 * Sets a single named cookie via Express's own built-in `res.cookie()` (no library needed — it
 * already URL-encodes values and sets sensible defaults).
 *
 * @param res - The response to attach the `Set-Cookie` header to.
 * @param name - The cookie's name.
 * @param value - The cookie's value.
 */
export function setCookie(res: Response, name: string, value: string): void {
  res.cookie(name, value);
}

/**
 * Clears a single named cookie via Express's own built-in `res.clearCookie()`, idempotent even if
 * the cookie was never set (FR-017 Edge Case).
 *
 * @param res - The response to attach the expiring `Set-Cookie` header to.
 * @param name - The cookie's name.
 */
export function clearCookie(res: Response, name: string): void {
  res.clearCookie(name);
}

/**
 * Validates `DELETE /cookies`'s `?name=` query parameter.
 *
 * @param raw - The raw query value, of unknown shape until validated.
 * @returns The validated, non-empty cookie name.
 * @throws HttpError(400) if `raw` is not a non-empty string.
 */
export function parseCookieName(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'name' is required and must be non-empty.", {
      field: "name",
      value: raw,
    });
  }
  return raw;
}
