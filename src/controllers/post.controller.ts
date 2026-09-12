import type { Request, Response } from "express";
import { parseUuidParam } from "../utils/uuidParam";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as postService from "../services/post.service";

/**
 * Handles `GET /posts`: lists posts via `postService.listPosts`, applying the pagination/sort/
 * filter options in the query string, and responds `200` with a paginated envelope built by
 * `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listPosts(req: Request, res: Response): void {
  const { data, page, limit, total } = postService.listPosts(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /posts/:id`: parses the `id` path param via `parseUuidParam` and looks up the post
 * via `postService.getPostById`, responding `200` with the post.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getPostById(req: Request, res: Response): void {
  const id = parseUuidParam(req.params.id, "post");
  res.status(200).json(postService.getPostById(id));
}

/**
 * Handles `GET /users/:id/posts`: parses the user `id` path param via `parseIdParam` and lists
 * that user's posts via `postService.listPostsForUser`, applying pagination/sort/filter options
 * from the query string, responding `200` with a paginated envelope.
 * @param req - Express request; reads the user `id` path parameter and query options.
 * @param res - Express response.
 */
export function listPostsForUser(req: Request, res: Response): void {
  const userId = parseIdParam(req.params.id, "user");
  const { data, page, limit, total } = postService.listPostsForUser(
    userId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `POST /users/:id/posts`: parses the user `id` path param via `parseIdParam` and creates
 * a new post for that user from the request body via `postService.createPostForUser`, responding
 * `201` with the created post.
 * @param req - Express request; reads the user `id` path parameter and the post body.
 * @param res - Express response.
 */
export function createPostForUser(req: Request, res: Response): void {
  const userId = parseIdParam(req.params.id, "user");
  res.status(201).json(postService.createPostForUser(userId, req.body));
}
