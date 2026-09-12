/**
 * Comment routes: read-only listing/lookup by id, plus the nested `posts/:id/comments` list and create
 * routes. No authentication is required on any of these routes.
 */
import { Router } from "express";
import * as commentController from "../controllers/comment.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const commentRouter = Router({ strict: true });

commentRouter.get("/comments", commentController.listComments);
commentRouter.all("/comments", methodNotAllowedHandler);

commentRouter.get("/comments/:id", commentController.getCommentById);
commentRouter.all("/comments/:id", methodNotAllowedHandler);

commentRouter.get("/posts/:id/comments", commentController.listCommentsForPost);
commentRouter.post("/posts/:id/comments", commentController.createCommentForPost);
commentRouter.all("/posts/:id/comments", methodNotAllowedHandler);
