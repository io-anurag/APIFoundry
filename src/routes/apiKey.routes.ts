/**
 * API key auth routes: issuing, using, and revoking `X-API-Key` credentials.
 *
 * - `POST /auth/api-key` issues a new key and is intentionally unauthenticated, mirroring
 *   `POST /auth/token` (spec.md Assumptions).
 * - `GET /api-key/protected` is gated by `apiKeyAuth` and demonstrates a successful API-key-protected
 *   request.
 * - `POST /auth/api-key/revoke` is deliberately NOT gated by `apiKeyAuth`: its own lookup logic
 *   distinguishes 401 (missing) vs 404 (never issued) vs an idempotent 200 (already revoked), which the
 *   enforcing middleware's uniform-401 semantics can't express (mirroring how Spec 005's `/auth/logout`
 *   bypasses `authenticate` for the same reason).
 */
import { Router } from "express";
import * as apiKeyController from "../controllers/apiKey.controller";
import { apiKeyAuth } from "../middleware/apiKeyAuth";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const apiKeyRouter = Router({ strict: true });

// Unauthenticated by design, mirroring POST /auth/token (spec.md Assumptions).
apiKeyRouter.post("/auth/api-key", apiKeyController.issueApiKey);
apiKeyRouter.all("/auth/api-key", methodNotAllowedHandler);

apiKeyRouter.get("/api-key/protected", apiKeyAuth, apiKeyController.getApiKeyProtected);
apiKeyRouter.all("/api-key/protected", methodNotAllowedHandler);

// Not gated by `apiKeyAuth` — its own lookup distinguishes 401 (missing) vs 404 (never issued) vs
// idempotent 200 (already revoked), which the enforcing middleware's uniform-401 semantics can't
// express (mirroring how Spec 005's /auth/logout bypasses `authenticate` for the same reason).
apiKeyRouter.post("/auth/api-key/revoke", apiKeyController.revokeApiKey);
apiKeyRouter.all("/auth/api-key/revoke", methodNotAllowedHandler);
