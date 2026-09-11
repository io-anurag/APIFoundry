import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { parseUuidParam } from "../utils/uuidParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as commentService from "../services/comment.service";

export function listComments(req: Request, res: Response): void {
  const { data, page, limit, total } = commentService.listComments(
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getCommentById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "comment");
  res.status(200).json(commentService.getCommentById(id));
}

export function listCommentsForPost(req: Request, res: Response): void {
  const postId = parseUuidParam(req.params.id, "post");
  const { data, page, limit, total } = commentService.listCommentsForPost(
    postId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function createCommentForPost(req: Request, res: Response): void {
  const postId = parseUuidParam(req.params.id, "post");
  res.status(201).json(commentService.createCommentForPost(postId, req.body));
}
