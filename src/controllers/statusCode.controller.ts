import type { Request, Response } from "express";
import { config } from "../config";
import { parseStatusCodeParam } from "../utils/statusCodeParam";
import { getStatusCodeDemo } from "../services/statusCode.service";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { requestIdOf } from "../middleware/requestId";

/**
 * Handles `GET /api/v1/status/:code`: parses the `code` path param via `parseStatusCodeParam` and
 * looks up its demo behavior via `getStatusCodeDemo`, then sends a response shaped to match that
 * status code's semantics — a JSON body for `"success"`, an empty body via `res.end()` for
 * `"noBody"` (e.g. 204), a `Location` header plus JSON for `"redirect"` (e.g. 301/302), or the
 * standard error envelope (via `buildErrorEnvelope`, with any extra headers demo requires) for
 * `"error"` codes. The response status code always equals the requested `:code`.
 * @param req - Express request; reads the `code` path parameter.
 * @param res - Express response.
 */
export function demonstrateStatusCode(req: Request, res: Response): void {
  const code = parseStatusCodeParam(req.params.code);
  const demo = getStatusCodeDemo(code);

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
      res.status(demo.code).json(buildErrorEnvelope(demo.errorCode as string, demo.message, requestIdOf(req)));
      return;
    }
  }
}
