import { z } from "zod";
import { API_KEY_KINDS } from "./apiKey";

export const apiKeyIssueRequestSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    kind: z.enum(API_KEY_KINDS).optional(),
  })
  .strict();
