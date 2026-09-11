import { z } from "zod";

export interface Comment {
  id: number;
  postId: string;
  userId: number;
  body: string;
  createdAt: string;
}

// No `postId` field: the parent post is always set from the URL, never accepted from the request
// body (FR-018). `userId` (the comment's author) IS accepted here and validated against the user
// store by the service layer (FR-011, Clarifications).
export const commentCreateSchema = z
  .object({
    userId: z.number().int().positive(),
    body: z.string().min(1).max(1000),
  })
  .strict();

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
