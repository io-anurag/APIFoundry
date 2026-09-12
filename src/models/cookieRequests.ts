import { z } from "zod";

/**
 * Validation schema for `POST /cookies`'s request body: `name` must be a non-empty string,
 * `value` may be any string including empty (data-model.md, FR-017).
 */
export const cookieSetRequestSchema = z
  .object({
    name: z.string().min(1),
    value: z.string(),
  })
  .strict();
