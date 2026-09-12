import { randomUUID } from "node:crypto";
import { createKeyedStore } from "./keyedStore";
import type { Payment } from "../models/payment";
import { orderStore } from "./orders.seed";
import { PAYMENT_STATUSES } from "../models/enums";

export const paymentStore = createKeyedStore<Payment>();

const BASE_DATE = Date.UTC(2026, 0, 1); // 2026-01-01, deterministic epoch for processedAt spread
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Formats an epoch-millisecond timestamp as a date-only ISO string (`YYYY-MM-DD`).
 *
 * @param epochMs - Milliseconds since the Unix epoch.
 * @returns The date portion of that timestamp's ISO string.
 */
function toDateOnly(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * Builds exactly one deterministic seed payment per seeded order, spreading each payment's
 * `processedAt` date one day apart starting from a fixed base date, cycling through every
 * documented payment status.
 *
 * @returns The complete array of seed `Payment` records.
 */
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
