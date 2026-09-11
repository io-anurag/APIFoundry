import type { NextFunction, Request, Response } from "express";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { HttpError } from "../utils/httpError";
import { requestIdOf } from "./requestId";

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

function isJsonParseError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) return false;
  const withMeta = err as SyntaxError & { status?: number; statusCode?: number; type?: string };
  return (withMeta.status === 400 || withMeta.statusCode === 400) && withMeta.type === "entity.parse.failed";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = requestIdOf(req);

  if (err instanceof HttpError) {
    res.status(err.statusCode).json(buildErrorEnvelope(err.code, err.message, requestId));
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
