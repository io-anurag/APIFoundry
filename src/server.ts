import { config } from "./config";
import { app } from "./app";
import { logger } from "./utils/logger";

app.listen(config.port, () => {
  logger.info(`APIFoundry listening on port ${config.port} (${config.nodeEnv})`);
});
