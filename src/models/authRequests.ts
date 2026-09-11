import { z } from "zod";
import { SCOPES, USER_ROLES } from "./enums";
import { TOKEN_KINDS } from "./authTokenClaims";

export const loginRequestSchema = z
  .object({
    username: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const refreshRequestSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const tokenIssueRequestSchema = z
  .object({
    role: z.enum(USER_ROLES),
    scopes: z.array(z.enum(SCOPES)),
    kind: z.enum(TOKEN_KINDS),
  })
  .strict();
