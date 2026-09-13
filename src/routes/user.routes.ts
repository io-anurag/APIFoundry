/**
 * User routes: full CRUD (`GET` list/one, `POST`, `PUT`, `PATCH`, `DELETE`), gated by bearer-token
 * auth — reads require the `users:read` scope, writes require `users:write` (either satisfied by
 * `admin`). `Router({ strict: true })` so a trailing slash (e.g. "/users/") does not alias the
 * collection route — it falls through to the app-level 404 handler instead of silently matching
 * "/users" (FR-006 edge case).
 */
import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";
import { requireScope } from "../middleware/requireScope";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash (e.g. "/users/") does not alias the collection route — it falls
// through to the app-level 404 handler instead of silently matching "/users" (FR-006 edge case).
export const userRouter = Router({ strict: true });

userRouter.get("/users", authenticate, requireScope("users:read"), userController.listUsers);
userRouter.post("/users", authenticate, requireScope("users:write"), userController.createUser);
userRouter.all("/users", methodNotAllowedHandler);

userRouter.get("/users/:id", authenticate, requireScope("users:read"), userController.getUserById);
userRouter.put("/users/:id", authenticate, requireScope("users:write"), userController.replaceUser);
userRouter.patch("/users/:id", authenticate, requireScope("users:write"), userController.patchUser);
userRouter.delete("/users/:id", authenticate, requireScope("users:write"), userController.deleteUser);
userRouter.all("/users/:id", methodNotAllowedHandler);
