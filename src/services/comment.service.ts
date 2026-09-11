import { commentStore } from "../data/comments.seed";
import { postStore } from "../data/posts.seed";
import { userStore } from "../data/users.seed";
import { commentCreateSchema, type Comment } from "../models/comment";
import { HttpError } from "../utils/httpError";
import { parseListQuery, lastQueryValue } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

const ALLOWED_SORT_FIELDS = ["id", "postId", "userId", "createdAt"] as const;

export function listComments(
  rawQuery: Record<string, unknown>
): ListQueryResult<Comment> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const postId = lastQueryValue(rawQuery.postId);
  const filters = postId ? [(comment: Comment) => comment.postId === postId] : [];
  const { data, total } = applyListQuery(commentStore.list(), query, { filters });
  return { data, total, page: query.page, limit: query.limit };
}

export function getCommentById(id: number): Comment {
  const comment = commentStore.get(id);
  if (!comment) throw new HttpError(404, "RESOURCE_NOT_FOUND", `Comment ${id} not found.`);
  return comment;
}

/** Lists comments on a post (posts/:id/comments, FR-011). 404 if the post doesn't exist first. */
export function listCommentsForPost(
  postId: string,
  rawQuery: Record<string, unknown>
): ListQueryResult<Comment> & { page: number; limit: number } {
  if (!postStore.get(postId)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Post ${postId} not found.`);
  }

  const query = parseListQuery(rawQuery, { allowedSortFields: ALLOWED_SORT_FIELDS });
  const { data, total } = applyListQuery(commentStore.list(), query, {
    filters: [(comment: Comment) => comment.postId === postId],
  });
  return { data, total, page: query.page, limit: query.limit };
}

/**
 * Creates a comment on a post (posts/:id/comments, FR-011, FR-018). 404 if the post doesn't exist
 * first; `postId` is always set from the URL, never from the body. `userId` (the comment's author)
 * comes from the body and is validated against the user store, rejecting an unknown/missing value.
 */
export function createCommentForPost(postId: string, rawBody: unknown): Comment {
  if (!postStore.get(postId)) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", `Post ${postId} not found.`);
  }

  const input = commentCreateSchema.parse(rawBody);
  if (!userStore.get(input.userId)) {
    throw new HttpError(400, "VALIDATION_ERROR", `userId ${input.userId} does not reference an existing user.`, {
      field: "userId",
      value: input.userId,
    });
  }

  return commentStore.create((id) => ({
    id,
    postId,
    userId: input.userId,
    body: input.body,
    createdAt: new Date().toISOString(),
  }));
}
