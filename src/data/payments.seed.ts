import { randomUUID } from "node:crypto";
import { createKeyedStore } from "./keyedStore";
import type { Payment } from "../models/payment";
import { orderStore } from "./orders.seed";
import { PAYMENT_STATUSES } from "../models/enums";

export const paymentStore = createKeyedStore<Payment>();

const BASE_DATE = Date.UTC(2026, 0, 1); // 2026-01-01, deterministic epoch for processedAt spread
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateOnly(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function buildSeedPayments(): Payment[] {
  const now = new Date().toISOString();
  const orders = orderStore.list();
  const payments: Payment[] = [];

  orders.forEach((order, index) => {
    payments.push({
      id: randomUUID(),
      orderId: order.id,
      amount: order.total,
      status: PAYMENT_STATUSES[index % PAYMENT_STATUSES.length],
      processedAt: toDateOnly(BASE_DATE + index * MS_PER_DAY),
      createdAt: now,
    });
  });

  return payments;
}

/**
 * Deterministically (re)populates the payment store — FR-002/FR-003. Must run after orders have
 * seeded (imported above) so every `orderId` reference resolves; exactly one payment per seeded
 * order.
 */
export function seedPayments(): void {
  paymentStore.reset(buildSeedPayments());
}

seedPayments();
