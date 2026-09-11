import { z } from "zod";

export interface CustomerAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  address: CustomerAddress;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
}

const addressSchema = z
  .object({
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  })
  .strict();

export const customerCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    address: addressSchema,
    userId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const customerPatchSchema = customerCreateSchema.partial().strict();

export type CustomerPatchInput = z.infer<typeof customerPatchSchema>;
