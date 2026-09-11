import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "./enums";

export interface OrderLineItem {
  productId: number;
  quantity: number;
}

export interface Order {
  id: number;
  customerId: number;
  items: OrderLineItem[];
  status: OrderStatus;
  total: number;
  createdAt: string;
  updatedAt: string;
}

const orderLineItemSchema = z
  .object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1),
  })
  .strict();

export const orderCreateSchema = z
  .object({
    customerId: z.number().int().positive(),
    items: z.array(orderLineItemSchema).min(1),
    status: z.enum(ORDER_STATUSES).optional(),
  })
  .strict();

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const orderPatchSchema = orderCreateSchema.partial().strict();

export type OrderPatchInput = z.infer<typeof orderPatchSchema>;
