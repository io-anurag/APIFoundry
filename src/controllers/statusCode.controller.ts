import type { Request, Response } from "express";
import { config } from "../config";
import { parseStatusCodeParam } from "../utils/statusCodeParam";
import { getStatusCodeDemo } from "../services/statusCode.service";
import { buildErrorEnvelope } from "../models/errorEnvelope";
import { requestIdOf } from "../middleware/requestId";

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
