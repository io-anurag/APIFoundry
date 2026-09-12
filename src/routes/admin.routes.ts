/**
 * Admin-token-gated operational routes that restore the mock server's mutable state to its seeded
 * configuration without a process restart: `POST /admin/reset` (data-plane) and
 * `POST /admin/auth/reset` (auth-plane), each independently gated by `adminAuth`.
 */
import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { adminAuth } from "../middleware/adminAuth";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const adminRouter = Router({ strict: true });

adminRouter.post("/admin/reset", adminAuth, adminController.postAdminReset);
adminRouter.all("/admin/reset", methodNotAllowedHandler);

adminRouter.post("/admin/auth/reset", adminAuth, adminController.postAdminAuthReset);
adminRouter.all("/admin/auth/reset", methodNotAllowedHandler);
