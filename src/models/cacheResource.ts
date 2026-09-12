import { z } from "zod";

export interface CacheResource {
  content: unknown;
  version: number;
  updatedAt: string;
}

export const cacheResourceUpdateSchema = z
  .object({ content: z.unknown() })
  .strict()
  .refine((data) => Object.prototype.hasOwnProperty.call(data, "content"), {
    message: "content is required",
    path: ["content"],
  });

export type CacheResourceUpdateRequest = z.infer<typeof cacheResourceUpdateSchema>;
