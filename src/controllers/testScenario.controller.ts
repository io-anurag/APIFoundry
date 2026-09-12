import type { Request, Response } from "express";
import { config } from "../config";
import { parseDelayMsParam } from "../utils/delayMsParam";
import { parseScenarioParam, resolveStatusOverride, resolveFailureRate } from "../models/testScenarioRequest";
import { resolveScenarioOutcome } from "../services/testScenario.service";
import { renderStatusCodeDemo } from "../services/statusCode.service";
import { generatePayload } from "../services/payload.service";
import { PAYLOAD_SIZE_PRESET_BYTES } from "../data/payloadPresets.catalog";
import { requestIdOf } from "../middleware/requestId";

/**
 * Handles `GET /api/v1/test`: the primary k6-facing scenario endpoint. Validates
 * `scenario`/`status`, then dispatches:
 * - `scenario=delayed`: waits the requested, bounded `delay` ms before responding (FR-009),
 *   mirroring `delay.controller.ts`'s non-`async`/`setTimeout` pattern so no promise ever enters
 *   Express's synchronous route-handling path.
 * - `scenario=large-response`: returns Spec 007's exact "large" payload preset (FR-010).
 * - every other scenario: resolves which StatusCodeDemo (or plain simulated success) to render,
 *   applying `failureRate` only for the four failure-representing scenarios (FR-011/FR-013), and
 *   renders it via the same shared renderer `/api/v1/status/:code` and `/errors/*` use.
 *
 * @param req - Express request; reads `scenario`/`status`/`delay`/`failureRate` from the query string.
 * @param res - Express response.
 */
export function getTestScenario(req: Request, res: Response): void {
  const scenario = parseScenarioParam(req.query.scenario);
  const statusOverride = resolveStatusOverride(req.query.status, scenario);
  const requestId = requestIdOf(req);

  if (scenario === "delayed") {
    const delayMs = parseDelayMsParam(req.query.delay, config.maxDelayMs);
    const status = statusOverride ?? 200;
    setTimeout(() => {
      res.status(status).json({ scenario, status, delayMs });
    }, delayMs);
    return;
  }

  if (scenario === "large-response") {
    // Deliberately no scenario/status wrapper here: FR-010 requires the response body's exact
    // byte size to match Spec 007's "large" preset, and generatePayload already computes `data`'s
    // filler length against a minimal {size, data} shell — any additional field would inflate the
    // body past that exact target.
    const status = statusOverride ?? 200;
    const payload = generatePayload(PAYLOAD_SIZE_PRESET_BYTES.large);
    res.status(status).json(payload);
    return;
  }

  const failureRate = resolveFailureRate(req.query.failureRate, scenario);
  const outcome = resolveScenarioOutcome(scenario, statusOverride, failureRate);

  if (outcome.kind === "demo") {
    renderStatusCodeDemo(outcome.demo, requestId, res);
    return;
  }

  res.status(200).json({ scenario, status: 200 });
}
