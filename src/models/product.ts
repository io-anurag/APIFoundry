import { z } from "zod";
import { PRODUCT_CATEGORIES, type ProductCategory } from "./enums";

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export const productCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    price: z.number().positive(),
    category: z.enum(PRODUCT_CATEGORIES),
    stock: z.number().int().nonnegative(),
  })
  .strict();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productPatchSchema = productCreateSchema.partial().strict();

export type ProductPatchInput = z.infer<typeof productPatchSchema>;
