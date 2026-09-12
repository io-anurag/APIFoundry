import type { Payment } from "./payment";

export interface IdempotencyRecord {
  id: string;
  requestHash: string;
  statusCode: 201;
  payment: Payment;
}
