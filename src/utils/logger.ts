import pino from "pino";

export const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "*.jwtSecret",
      "*.adminToken",
      "config.jwtSecret",
      "config.adminToken",
    ],
    censor: "[REDACTED]",
  },
});
