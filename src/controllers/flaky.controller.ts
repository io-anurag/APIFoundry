import type { Request, Response } from "express";
import { parseFailureRateParam } from "../models/flakyRequests";
import { rollFlakyOutcome } from "../services/flaky.service";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { requestIdOf } from "../middleware/requestId";
import { config } from "../config";

/**
 * Handles `GET /flaky?failureRate=`: simulates a flaky dependency, failing at approximately the
 * requested rate with a server-selected status from a configurable pool, reproducibly across
 * runs, and disableable entirely via `config.flakyEnabled` regardless of `failureRate`.
 *
 * @param req - The incoming request; `failureRate` is read from its query string.
 * @param res - Used to send the `200` or simulated-failure response.
 */
export function getFlaky(req: Request, res: Response): void {
  const failureRate = parseFailureRateParam(req.query.failureRate, config.failureRate);
  const outcome = rollFlakyOutcome(config.flakyEnabled, failureRate);

  if (outcome.failed && outcome.status) {
    res
      .status(outcome.status)
      .json(buildErrorEnvelope("SIMULATED_FAILURE", "Simulated flaky failure.", requestIdOf(req)));
    return;
  }

  res.status(200).json({ ok: true });
}
