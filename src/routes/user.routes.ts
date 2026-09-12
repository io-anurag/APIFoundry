/**
 * User routes: full CRUD (`GET` list/one, `POST`, `PUT`, `PATCH`, `DELETE`) with no authentication
 * required. `Router({ strict: true })` so a trailing slash (e.g. "/users/") does not alias the
 * collection route — it falls through to the app-level 404 handler instead of silently matching
 * "/users" (FR-006 edge case).
 */
import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash (e.g. "/users/") does not alias the collection route — it falls
// through to the app-level 404 handler instead of silently matching "/users" (FR-006 edge case).
export const userRouter = Router({ strict: true });

userRouter.get("/users", userController.listUsers);
userRouter.post("/users", userController.createUser);
userRouter.all("/users", methodNotAllowedHandler);

userRouter.get("/users/:id", userController.getUserById);
userRouter.put("/users/:id", userController.replaceUser);
userRouter.patch("/users/:id", userController.patchUser);
userRouter.delete("/users/:id", userController.deleteUser);
userRouter.all("/users/:id", methodNotAllowedHandler);
