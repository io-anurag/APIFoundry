import type { Request, Response } from "express";

/**
 * Handles `GET /auth-test/basic`: reachable only after the `basicAuth` middleware has already
 * validated the `Authorization: Basic` credentials and populated `req.basicAuthUser`, so
 * `authenticated` is always true here. Responds `200` with the authenticated username.
 * @param req - Express request; expects `req.basicAuthUser` set by `basicAuth`.
 * @param res - Express response.
 */
export function getBasicAuthDemo(req: Request, res: Response): void {
  res.status(200).json({ authenticated: true, username: req.basicAuthUser!.username });
}
