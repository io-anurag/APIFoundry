import type { Request, Response } from "express";
import { parseUuidParam } from "../utils/uuidParam";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as postService from "../services/post.service";

export function listPosts(req: Request, res: Response): void {
  const { data, page, limit, total } = postService.listPosts(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getPostById(req: Request, res: Response): void {
  const id = parseUuidParam(req.params.id, "post");
  res.status(200).json(postService.getPostById(id));
}

export function listPostsForUser(req: Request, res: Response): void {
  const userId = parseIdParam(req.params.id, "user");
  const { data, page, limit, total } = postService.listPostsForUser(
    userId,
    req.query as unknown as Record<string, unknown>
  );
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function createPostForUser(req: Request, res: Response): void {
  const userId = parseIdParam(req.params.id, "user");
  res.status(201).json(postService.createPostForUser(userId, req.body));
}
