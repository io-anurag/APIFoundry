import type { Request, Response } from "express";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { requestIdOf } from "./requestId";

/**
 * Mount with router.all(path, ...) *after* the route's real method handler(s). Express only
 * reaches this for the same path when no earlier handler matched the request's method, which is
 * exactly the "method not allowed" case (as opposed to the path not matching at all, which falls
 * through to the app-level notFoundHandler instead).
 */
/**
 * Responds 405 `METHOD_NOT_ALLOWED` for a request whose path matched a route but whose method did
 * not. See the module-level comment above for the required mounting order relative to the real
 * method handlers.
 *
 * @param req - The incoming Express request; read for method and original URL.
 * @param res - The Express response used to send the 405 JSON error envelope.
 */
export function methodNotAllowedHandler(req: Request, res: Response): void {
  res
    .status(405)
    .json(
      buildErrorEnvelope(
        "METHOD_NOT_ALLOWED",
        `Method ${req.method} not allowed on ${req.originalUrl}`,
        requestIdOf(req)
      )
    );
}
