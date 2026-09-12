/**
 * Constructs and configures the Express application: wires global middleware (request id, request
 * logging, CORS, JSON body parsing), mounts the meta/auth routers that live outside the versioned API
 * prefix (health, version, JWT auth, API key auth, basic auth, OpenAPI/Swagger docs), mounts every
 * resource/feature router under `config.apiPrefix`, marks the service ready (this spec has no async
 * bootstrap work), and registers the terminal 404 and error handlers. This module has no exported
 * function — it is top-level imperative wiring executed on import, exporting only the resulting `app`.
 * It never calls `app.listen()`; see src/server.ts for that.
 */
import express, { type Express, Router } from "express";
import { config } from "./config";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { corsMiddleware } from "./middleware/cors";
import { captureRawBody } from "./middleware/rawBody";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth.routes";
import { apiKeyRouter } from "./routes/apiKey.routes";
import { basicAuthRouter } from "./routes/basicAuth.routes";
import { delayRouter } from "./routes/delay.routes";
import { payloadRouter } from "./routes/payload.routes";
import { contentRouter } from "./routes/content.routes";
import { headersRouter } from "./routes/headers.routes";
import { cookiesRouter } from "./routes/cookies.routes";
import { rateLimitRouter } from "./routes/rateLimit.routes";
import { flakyRouter } from "./routes/flaky.routes";
import { cacheRouter } from "./routes/cache.routes";
import { filesRouter } from "./routes/files.routes";
import { errorsRouter } from "./routes/errors.routes";
import { adminRouter } from "./routes/admin.routes";
import { healthRouter } from "./routes/health.routes";
import { versionRouter } from "./routes/version.routes";
import { infoRouter } from "./routes/info.routes";
import { userRouter } from "./routes/user.routes";
import { productRouter } from "./routes/product.routes";
import { customerRouter } from "./routes/customer.routes";
import { orderRouter } from "./routes/order.routes";
import { categoryRouter } from "./routes/category.routes";
import { postRouter } from "./routes/post.routes";
import { commentRouter } from "./routes/comment.routes";
import { reviewRouter } from "./routes/review.routes";
import { paymentRouter } from "./routes/payment.routes";
import { searchRouter } from "./routes/search.routes";
import { statusCodeRouter } from "./routes/statusCode.routes";
import { testScenarioRouter } from "./routes/testScenario.routes";
import { protectedRouter } from "./routes/protected.routes";
import { roleRouter } from "./routes/role.routes";
import { scopeRouter } from "./routes/scope.routes";
import { openapiRouter } from "./openapi";
import { markReady } from "./services/health.service";

export const app: Express = express();
app.disable("x-powered-by");

app.use(requestId);
app.use(requestLogger);
app.use(corsMiddleware);
app.use(express.json({ limit: config.maxPayloadSize, verify: captureRawBody }));

// Meta endpoints live outside the versioned API prefix.
app.use(healthRouter);
app.use(versionRouter);
app.use(authRouter);
app.use(apiKeyRouter);
app.use(basicAuthRouter);
app.use(delayRouter);
app.use(payloadRouter);
app.use(contentRouter);
app.use(headersRouter);
app.use(cookiesRouter);
app.use(rateLimitRouter);
app.use(flakyRouter);
app.use(cacheRouter);
app.use(filesRouter);
app.use(errorsRouter);
app.use(adminRouter);
app.use(openapiRouter);

// Versioned resource/feature endpoints.
const apiRouter = Router();
apiRouter.use(infoRouter);
apiRouter.use(userRouter);
apiRouter.use(productRouter);
apiRouter.use(customerRouter);
apiRouter.use(orderRouter);
apiRouter.use(categoryRouter);
apiRouter.use(postRouter);
apiRouter.use(commentRouter);
apiRouter.use(reviewRouter);
apiRouter.use(paymentRouter);
apiRouter.use(searchRouter);
apiRouter.use(statusCodeRouter);
apiRouter.use(testScenarioRouter);
apiRouter.use(protectedRouter);
apiRouter.use(roleRouter);
apiRouter.use(scopeRouter);
app.use(config.apiPrefix, apiRouter);

// This spec has no async bootstrap work, so the app is "ready" as soon as its request pipeline
// finishes wiring above (see src/services/health.service.ts for the readiness/liveness distinction).
markReady();

app.use(notFoundHandler);
app.use(errorHandler);
