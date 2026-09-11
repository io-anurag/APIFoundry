import type { PaymentStatus } from "./enums";

export interface Payment {
  id: string;
  orderId: number;
  amount: number;
  status: PaymentStatus;
  processedAt: string;
  createdAt: string;
}
