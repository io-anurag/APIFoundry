import type { Request, Response } from "express";
import * as delayService from "../services/delay.service";

/**
 * Handles `GET /delay/:ms` and `GET /delay?ms=`: validates the requested delay synchronously (any
 * `HttpError` propagates through Express's normal synchronous dispatch), then responds after the
 * requested number of milliseconds via a plain `setTimeout` callback. Deliberately **not**
 * `async` — Express 4.x does not catch rejected promises from route handlers, so keeping this
 * handler fully synchronous (validation) plus callback-based (the delay itself) avoids ever
 * putting a promise in the request-handling path (research.md Decision 4 for Spec 007).
 *
 * @param req - The incoming request; carries `ms` via path or query depending on the matched route.
 * @param res - Used to send the `{ delayMs }` response once the timer fires.
 */
export function getDelay(req: Request, res: Response): void {
  const ms = delayService.resolveDelayMs(req);
  setTimeout(() => {
    res.status(200).json({ delayMs: ms });
  }, ms);
}
