import { z } from "zod";
import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "./enums";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export const userCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    role: z.enum(USER_ROLES),
    status: z.enum(USER_STATUSES).optional(),
  })
  .strict();

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userPatchSchema = userCreateSchema.partial().strict();

export type UserPatchInput = z.infer<typeof userPatchSchema>;
