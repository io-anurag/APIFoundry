import type { Response } from "express";
import type { StatusCodeDemo } from "../models/statusCodeDemo";
import { STATUS_CODE_DEMOS } from "../data/statusCodeDemos.catalog";
import { config } from "../config";
import { buildErrorEnvelope } from "../models/errorEnvelope";

/**
 * Looks up the canned demo response for a documented status code. `code` is guaranteed to already
 * have passed `parseStatusCodeParam` by the time this is called, so the lookup always hits — no
 * not-found handling is needed here.
 *
 * @param code - A status code already validated to be one of the documented demo codes.
 * @returns The matching StatusCodeDemo record describing how to respond.
 */
export function getStatusCodeDemo(code: number): StatusCodeDemo {
  return STATUS_CODE_DEMOS.find((demo) => demo.code === code) as StatusCodeDemo;
}

/**
 * Sends a response shaped to match a StatusCodeDemo's semantics — a JSON body for `"success"`, an
 * empty body via `res.end()` for `"noBody"` (e.g. 204), a `Location` header plus JSON for
 * `"redirect"` (e.g. 301/302), or the standard error envelope (via `buildErrorEnvelope`, with any
 * extra headers the demo requires) for `"error"` codes. The response status code always equals
 * `demo.code`. Shared by `GET /api/v1/status/:code` (Spec 004), `/errors/*`, and
 * `GET /api/v1/test` (Spec 010) so all three surfaces render every documented status identically.
 *
 * @param demo - The demo to render.
 * @param requestId - Request id to embed in an error envelope (unused for other shapes).
 * @param res - Express response.
 */
export function renderStatusCodeDemo(demo: StatusCodeDemo, requestId: string, res: Response): void {
  switch (demo.shape) {
    case "success":
      res.status(demo.code).json({ status: demo.code, name: demo.name, message: demo.message });
      return;
    case "noBody":
      res.status(demo.code).end();
      return;
    case "redirect": {
      const target = `${config.apiPrefix}/status/200`;
      res
        .status(demo.code)
        .set("Location", target)
        .json({ status: demo.code, name: demo.name, message: demo.message, location: target });
      return;
    }
    case "error": {
      if (demo.extraHeaders) {
        res.set(demo.extraHeaders);
      }
      res.status(demo.code).json(buildErrorEnvelope(demo.errorCode as string, demo.message, requestId));
      return;
    }
  }
}
