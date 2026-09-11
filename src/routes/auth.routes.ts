import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const authRouter = Router({ strict: true });

authRouter.post("/auth/login", authController.login);
authRouter.all("/auth/login", methodNotAllowedHandler);

// Not gated by `authenticate` — logout performs its own non-revocation-gated verification so a
// double-logout stays idempotent (research.md Decision 5).
authRouter.post("/auth/logout", authController.logout);
authRouter.all("/auth/logout", methodNotAllowedHandler);

authRouter.post("/auth/refresh", authController.refresh);
authRouter.all("/auth/refresh", methodNotAllowedHandler);

authRouter.get("/auth/me", authenticate, authController.getMe);
authRouter.all("/auth/me", methodNotAllowedHandler);

authRouter.post("/auth/token", authController.issueToken);
authRouter.all("/auth/token", methodNotAllowedHandler);

// Not gated by `authenticate` — this endpoint's purpose is to diagnose tokens `authenticate` would
// reject (research.md Decision 6).
authRouter.get("/auth/token-info", authController.getTokenInfo);
authRouter.all("/auth/token-info", methodNotAllowedHandler);
