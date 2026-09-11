import { z } from "zod";

export interface Post {
  id: string;
  userId: number;
  title: string;
  body: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

// No `userId` field: the author is always set from the URL's parent user id, never accepted from the
// request body (FR-018).
export const postCreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
  })
  .strict();

export type PostCreateInput = z.infer<typeof postCreateSchema>;
