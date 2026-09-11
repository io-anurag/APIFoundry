import type { Request, Response } from "express";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { requestIdOf } from "./requestId";

/**
 * Mount with router.all(path, ...) *after* the route's real method handler(s). Express only
 * reaches this for the same path when no earlier handler matched the request's method, which is
 * exactly the "method not allowed" case (as opposed to the path not matching at all, which falls
 * through to the app-level notFoundHandler instead).
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
