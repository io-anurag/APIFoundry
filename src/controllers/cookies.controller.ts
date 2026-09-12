import type { Request, Response } from "express";
import * as cookiesService from "../services/cookies.service";
import { cookieSetRequestSchema } from "../models/cookieRequests";

/**
 * Handles `GET /cookies`: reports every cookie present on the request.
 *
 * @param req - The incoming request; its `Cookie` header is parsed.
 * @param res - Used to send the `{ cookies }` response.
 */
export function getCookies(req: Request, res: Response): void {
  res.status(200).json({ cookies: cookiesService.listCookies(req) });
}

/**
 * Handles `POST /cookies`: sets one named cookie without disturbing any other cookie held.
 *
 * @param req - The incoming request; its body is validated against `cookieSetRequestSchema`.
 * @param res - Used to attach the `Set-Cookie` header and send the `{ name, value }` response.
 */
export function postCookies(req: Request, res: Response): void {
  const { name, value } = cookieSetRequestSchema.parse(req.body);
  cookiesService.setCookie(res, name, value);
  res.status(200).json({ name, value });
}

/**
 * Handles `DELETE /cookies`: clears one named cookie via `?name=`, leaving every other cookie
 * intact. Idempotent — clearing a never-set name still returns 200 (FR-017 Edge Case).
 *
 * @param req - The incoming request; carries the name via `req.query.name`.
 * @param res - Used to attach the expiring `Set-Cookie` header and send the `{ cleared, name }` response.
 */
export function deleteCookies(req: Request, res: Response): void {
  const name = cookiesService.parseCookieName(req.query.name);
  cookiesService.clearCookie(res, name);
  res.status(200).json({ cleared: true, name });
}
