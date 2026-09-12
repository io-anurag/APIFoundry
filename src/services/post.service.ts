import { randomUUID } from "node:crypto";
import { postStore } from "../data/posts.seed";
import { userStore } from "../data/users.seed";
import { postCreateSchema, type Post } from "../models/post";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "userId", "publishedAt", "createdAt"] as const;

/**
 * Lists posts with pagination/sorting, optionally filtered to a single `userId`.
 *
 * @param rawQuery - Raw query-string parameters (page, limit, sort, userId, etc.).
 * @returns The matching page of posts plus the total count, page, and limit used.
 */
export function listPosts(
  rawQuery: Record<string, unknown>
): ListQueryResult<Post> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const userIdRaw = lastQueryValue(rawQuery.userId);
  const filters = userIdRaw ? [(post: Post) => String(post.userId) === userIdRaw] : [];
  const { data, total } = applyListQuery(postStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Looks up a single post by id.
 *
 * @param id - The post id to look up.
 * @returns The matching post.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no post has that id.
 */
export function getPostById(id: string): Post {
  const post = postStore.get(id);
  if (!post) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Post ${id} not found.`);
  return post;
}

/**
 * Lists posts authored by a user (users/:id/posts, FR-010). 404 if the user doesn't exist first.
 *
 * @param userId - The id of the user whose posts should be listed.
 * @param rawQuery - Raw query-string parameters (page, limit, sort, etc.).
 * @returns The matching page of posts plus the total count, page, and limit used.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if the user doesn't exist.
 */
export function listPostsForUser(
  userId: number,
  rawQuery: Record<string, unknown>
): ListQueryResult<Post> & { page: number; limit: number } {
  if (!userStore.get(userId)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${userId} not found.`);
  }

  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(postStore.list(), query, {
    filters: [(post: Post) => post.userId === userId],
  });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Creates a post authored by a user (users/:id/posts, FR-010, FR-018). 404 if the user doesn't exist
 * first; `userId` is always set from the URL, never from the body (postCreateSchema has no such
 * field, so one is rejected as an unexpected field rather than silently applied).
 *
 * @param userId - The id of the user the post is authored by.
 * @param rawBody - Request body containing `title` and `body`, validated against `postCreateSchema`.
 * @returns The newly created post record.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if the user doesn't exist.
 */
export function createPostForUser(userId: number, rawBody: unknown): Post {
  if (!userStore.get(userId)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `User ${userId} not found.`);
  }

  const input = postCreateSchema.parse(rawBody);
  const now = new Date().toISOString();
  return postStore.create({
    id: randomUUID(),
    userId,
    title: input.title,
    body: input.body,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}
