/**
 * Process entrypoint: imports the already-configured Express `app` (see src/app.ts, which wires
 * middleware and routes but never calls `listen()`), starts it listening on `config.port`, and logs a
 * startup message on success. This module has no exported function — it is top-level imperative
 * bootstrap code executed on import.
 */
import { config } from "./config";
import { app } from "./app";
import { logger } from "./utils/logger";

app.listen(config.port, () => {
  logger.info(`APIFoundry listening on port ${config.port} (${config.nodeEnv})`);
});
