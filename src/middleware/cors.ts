import cors, { type CorsOptions } from "cors";
import { config } from "../config";
import { HttpError } from "../utils/httpError";

/**
 * Builds an Express CORS middleware for a given origin policy. Pure factory so tests can build a
 * middleware for a specific corsOriginValue without touching the process-wide config singleton.
 * `"*"` allows every origin; otherwise the value is split into a comma-separated allow-list, and
 * requests with no `Origin` header (curl, server-to-server) are treated as same-origin and
 * allowed. A disallowed origin is rejected with a 403 `HttpError` (`CORS_NOT_ALLOWED`).
 *
 * @param corsOriginValue - `"*"` or a comma-separated list of allowed origins.
 * @returns An Express middleware enforcing the resulting CORS policy.
 */
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
