import type { Request } from "express";
import pinoHttp from "pino-http";
import { logger } from "../utils/logger";
import { requestIdOf } from "./requestId";

// req.id is already set by the requestId middleware mounted before this one; pino-http reuses an
// existing req.id automatically (`req.id = req.id || genReqId(...)`), so no genReqId override is needed.
//
// Two log lines are emitted per request (CLAUDE.md #29: timestamp/requestId/method/URL/status/
// responseTime on every request): `customReceivedMessage` turns on pino-http's request-received
// log immediately on arrival, and the existing customSuccessMessage/customErrorMessage cover the
// completion log once a response is sent. `customProps` stamps requestId onto both lines since the
// req serializer below deliberately excludes headers/body (avoids ever logging Authorization or
// other secret-bearing header values).
export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  // req is structurally an Express Request at runtime here (pino-http is mounted as Express
  // middleware); the cast reuses requestIdOf's existing, already-justified `String(req.id)`
  // narrowing instead of duplicating it.
  customProps: (req) => ({
    requestId: requestIdOf(req as Request),
  }),
  customReceivedMessage: (req) => `${req.method} ${req.url} received`,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} ${err.message}`,
});
