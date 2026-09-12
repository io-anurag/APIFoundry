import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { parseUuidParam } from "../utils/uuidParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as commentService from "../services/comment.service";

/**
 * Handles `GET /comments`: lists comments via `commentService.listComments`, applying the
 * pagination/sort/filter options in the query string, and responds `200` with a paginated
 * envelope built by `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listComments(req: Request, res: Response): void {
  const { data, page, limit, total } = commentService.listComments(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /comments/:id`: parses the `id` path param via `parseIdParam` and looks up the
 * comment via `commentService.getCommentById`, responding `200` with the comment.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getCommentById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "comment");
  res.status(200).json(commentService.getCommentById(id));
}

/**
 * Handles `GET /posts/:id/comments`: parses the post `id` path param via `parseUuidParam` and
 * lists that post's comments via `commentService.listCommentsForPost`, applying pagination/sort/
 * filter options from the query string, responding `200` with a paginated envelope.
 * @param req - Express request; reads the post `id` path parameter and query options.
 * @param res - Express response.
 */
export function listCommentsForPost(req: Request, res: Response): void {
  const postId = parseUuidParam(req.params.id, "post");
  const { data, page, limit, total } = commentService.listCommentsForPost(
    postId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `POST /posts/:id/comments`: parses the post `id` path param via `parseUuidParam` and
 * creates a new comment under that post from the request body via
 * `commentService.createCommentForPost`, responding `201` with the created comment.
 * @param req - Express request; reads the post `id` path parameter and the comment body.
 * @param res - Express response.
 */
export function createCommentForPost(req: Request, res: Response): void {
  const postId = parseUuidParam(req.params.id, "post");
  res.status(201).json(commentService.createCommentForPost(postId, req.body));
}
