import type { Request, Response } from "express";
import { parseStatusCodeParam } from "../utils/statusCodeParam";
import { getStatusCodeDemo, renderStatusCodeDemo } from "../services/statusCode.service";
import { requestIdOf } from "../middleware/requestId";

/**
 * Handles `GET /api/v1/status/:code`: parses the `code` path param via `parseStatusCodeParam` and
 * looks up its demo behavior via `getStatusCodeDemo`, then renders it via `renderStatusCodeDemo`
 * (shared with `/errors/*` and `GET /api/v1/test`, Spec 010). The response status code always
 * equals the requested `:code`.
 * @param req - Express request; reads the `code` path parameter.
 * @param res - Express response.
 */
export function demonstrateStatusCode(req: Request, res: Response): void {
  const code = parseStatusCodeParam(req.params.code);
  const demo = getStatusCodeDemo(code);
  renderStatusCodeDemo(demo, requestIdOf(req), res);
}
