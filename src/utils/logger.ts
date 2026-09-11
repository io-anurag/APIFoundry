import pino from "pino";

export const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.jwtSecret",
      "*.adminToken",
      "config.jwtSecret",
      "config.adminToken",
    ],
    censor: "[REDACTED]",
  },
});
