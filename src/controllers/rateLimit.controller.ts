import type { Request, Response } from "express";
import { checkRateLimit } from "../services/rateLimit.service";
import { resolveCallerIdentity } from "../utils/callerIdentity";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { requestIdOf } from "../middleware/requestId";
import { config } from "../config";

/**
 * Handles `GET /rate-limit`: tracks a per-caller request count against the configured threshold
 * and window, returning `200` with the remaining quota while under it, or `429` with a
 * `Retry-After` header once exceeded. Builds the error envelope directly rather than throwing an
 * `HttpError` because the shared `errorHandler` has no mechanism to attach a response header
 * (FR-002).
 *
 * @param req - The incoming request; caller identity is resolved from it.
 * @param res - Used to send the `200`/`429` response.
 */
export function getRateLimit(req: Request, res: Response): void {
  const result = checkRateLimit(
    resolveCallerIdentity(req),
    config.rateLimitEnabled,
    config.rateLimitRequests,
    config.rateLimitWindowMs
  );

  if (!result.allowed) {
    res
      .set("Retry-After", String(result.retryAfterSec))
      .status(429)
      .json(
        buildErrorEnvelope(
          "RATE_LIMIT_EXCEEDED",
          "Rate limit exceeded for this caller.",
          requestIdOf(req)
        )
      );
    return;
  }

  res.status(200).json({ remaining: result.remaining, limit: result.limit });
}
