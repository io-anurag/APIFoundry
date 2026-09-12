/**
 * Post routes: read-only listing/lookup by id, plus the nested `users/:id/posts` list and create
 * routes. No authentication is required.
 */
import { Router } from "express";
import * as postController from "../controllers/post.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

export const postRouter = Router({ strict: true });

postRouter.get("/posts", postController.listPosts);
postRouter.all("/posts", methodNotAllowedHandler);

postRouter.get("/posts/:id", postController.getPostById);
postRouter.all("/posts/:id", methodNotAllowedHandler);

postRouter.get("/users/:id/posts", postController.listPostsForUser);
postRouter.post("/users/:id/posts", postController.createPostForUser);
postRouter.all("/users/:id/posts", methodNotAllowedHandler);
