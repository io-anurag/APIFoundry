import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { HttpError } from "../utils/httpError";
import { requestIdOf } from "./requestId";

/**
 * Terminal Express handler for requests that matched no route. Always responds 404 with a
 * `RESOURCE_NOT_FOUND` error envelope naming the unmatched method and URL.
 *
 * @param req - The incoming Express request; read for method and original URL.
 * @param res - The Express response used to send the 404 JSON error envelope.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json(
      buildErrorEnvelope(
        "RESOURCE_NOT_FOUND",
        `Route not found: ${req.method} ${req.originalUrl}`,
        requestIdOf(req)
      )
    );
}

/**
 * Detects whether a caught error is body-parser's JSON syntax-error shape, as opposed to any
 * other `SyntaxError` or unrelated error.
 *
 * @param err - The caught error value to inspect.
 * @returns `true` if `err` is a `SyntaxError` with `status`/`statusCode` 400 and `type` `"entity.parse.failed"`.
 */
function isJsonParseError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) return false;
  const withMeta = err as SyntaxError & { status?: number; statusCode?: number; type?: string };
  return (withMeta.status === 400 || withMeta.statusCode === 400) && withMeta.type === "entity.parse.failed";
}

/**
 * Express error-handling middleware mounted last in the chain. Converts a caught error into the
 * standard JSON error envelope: an `HttpError` is rendered with its own status/code/details; a
 * `ZodError` becomes a 400 `VALIDATION_ERROR` with flattened field/form errors; a body-parser JSON
 * syntax error (per `isJsonParseError`) becomes a 400 `VALIDATION_ERROR`; anything else is logged
 * via `req.log` and rendered as a 500 `INTERNAL_ERROR`.
 *
 * @param err - The error thrown or passed to `next()` upstream.
 * @param req - The Express request; used for the request id and logging.
 * @param res - The Express response used to send the JSON error envelope.
 * @param _next - Unused; required so Express recognizes this as an error-handling middleware.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = requestIdOf(req);

  if (err instanceof HttpError) {
    res.status(err.statusCode).json(buildErrorEnvelope(err.code, err.message, requestId, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const { fieldErrors, formErrors } = err.flatten();
    res
      .status(400)
      .json(
        buildErrorEnvelope("VALIDATION_ERROR", "Request body failed validation", requestId, {
          fieldErrors,
          formErrors,
        })
      );
    return;
  }

  if (isJsonParseError(err)) {
    res
      .status(400)
      .json(
        buildErrorEnvelope("VALIDATION_ERROR", "Request body is not valid JSON", requestId, {
          reason: (err as Error).message,
        })
      );
    return;
  }

  const reason = err instanceof Error ? err.message : "Unknown error";
  req.log?.error({ err }, "Unhandled error");
  res
    .status(500)
    .json(buildErrorEnvelope("INTERNAL_ERROR", "An unexpected error occurred", requestId, { reason }));
}
