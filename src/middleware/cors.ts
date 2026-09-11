import cors, { type CorsOptions } from "cors";
import { config } from "../config";
import { HttpError } from "../utils/httpError";

/** Pure factory so tests can build a middleware for a specific corsOriginValue without touching the process-wide config singleton. */
export function buildCorsMiddleware(corsOriginValue: string) {
  if (corsOriginValue === "*") {
    return cors({ origin: "*" });
  }

  const allowList = new Set(corsOriginValue.split(",").map((origin) => origin.trim()));

  const origin: CorsOptions["origin"] = (requestOrigin, callback) => {
    // Requests with no Origin header (curl, server-to-server) are not cross-origin; allow them.
    if (!requestOrigin || allowList.has(requestOrigin)) {
      callback(null, true);
      return;
    }
    callback(new HttpError(403, "CORS_NOT_ALLOWED", "Origin not allowed by CORS policy"));
  };

  return cors({ origin });
}

export const corsMiddleware = buildCorsMiddleware(config.corsOrigin);
