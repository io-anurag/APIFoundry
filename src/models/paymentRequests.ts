import { z } from "zod";
import { PAYMENT_STATUSES } from "./enums";

export const createPaymentRequestSchema = z
  .object({
    orderId: z.number().int().positive(),
    amount: z.number().nonnegative(),
    status: z.enum(PAYMENT_STATUSES),
  })
  .strict();

export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;
