import express, { type Express, Router } from "express";
import { config } from "./config";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { corsMiddleware } from "./middleware/cors";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { healthRouter } from "./routes/health.routes";
import { versionRouter } from "./routes/version.routes";
import { infoRouter } from "./routes/info.routes";
import { openapiRouter } from "./openapi";
import { markReady } from "./services/health.service";

export const app: Express = express();
app.disable("x-powered-by");

app.use(requestId);
app.use(requestLogger);
app.use(corsMiddleware);
app.use(express.json());

// Meta endpoints live outside the versioned API prefix.
app.use(healthRouter);
app.use(versionRouter);
app.use(openapiRouter);

// Versioned resource/feature endpoints.
const apiRouter = Router();
apiRouter.use(infoRouter);
app.use(config.apiPrefix, apiRouter);

// This spec has no async bootstrap work, so the app is "ready" as soon as its request pipeline
// finishes wiring above (see src/services/health.service.ts for the readiness/liveness distinction).
markReady();

app.use(notFoundHandler);
app.use(errorHandler);
