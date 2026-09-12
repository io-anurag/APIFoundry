import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetStores } from "./helpers/resetStores";

const VALID_BODY = { orderId: 1, amount: 42.5, status: "pending" };

describe("Idempotent payments (User Story 3)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("creates exactly one payment for a fresh Idempotency-Key", async () => {
    const key = randomUUID();
    const res = await request(app)
      .post("/api/v1/payments")
      .set("Idempotency-Key", key)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBe(VALID_BODY.orderId);
    expect(res.body.amount).toBe(VALID_BODY.amount);
    expect(res.body.status).toBe(VALID_BODY.status);
    expect(typeof res.body.id).toBe("string");
  });

  it("replays the original payment for an identical retry, without creating a duplicate", async () => {
    const key = randomUUID();
    const beforeTotal = (await request(app).get("/api/v1/payments?limit=1")).body.pagination.total;

    const first = await request(app).post("/api/v1/payments").set("Idempotency-Key", key).send(VALID_BODY);
    const afterFirstTotal = (await request(app).get("/api/v1/payments?limit=1")).body.pagination.total;

    const second = await request(app).post("/api/v1/payments").set("Idempotency-Key", key).send(VALID_BODY);
    const afterSecondTotal = (await request(app).get("/api/v1/payments?limit=1")).body.pagination.total;

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(afterFirstTotal).toBe(beforeTotal + 1);
    expect(afterSecondTotal).toBe(afterFirstTotal);
  });

  it("rejects a same-key-different-body reuse with 409", async () => {
    const key = randomUUID();
    await request(app).post("/api/v1/payments").set("Idempotency-Key", key).send(VALID_BODY);
    const conflict = await request(app)
      .post("/api/v1/payments")
      .set("Idempotency-Key", key)
      .send({ ...VALID_BODY, amount: 99 });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it("rejects a request missing the Idempotency-Key header", async () => {
    const res = await request(app).post("/api/v1/payments").send(VALID_BODY);
    expect(res.status).toBe(400);
  });

  it("rejects an invalid body without reserving the key for a later valid retry", async () => {
    const key = randomUUID();
    const invalid = await request(app)
      .post("/api/v1/payments")
      .set("Idempotency-Key", key)
      .send({ orderId: 1, amount: 42.5 }); // missing required `status`

    expect(invalid.status).toBe(400);

    const validRetry = await request(app)
      .post("/api/v1/payments")
      .set("Idempotency-Key", key)
      .send(VALID_BODY);
    expect(validRetry.status).toBe(201);
  });

  it("creates only one payment when two concurrent requests share a fresh key", async () => {
    const key = randomUUID();
    const [first, second] = await Promise.all([
      request(app).post("/api/v1/payments").set("Idempotency-Key", key).send(VALID_BODY),
      request(app).post("/api/v1/payments").set("Idempotency-Key", key).send(VALID_BODY),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 201]);
    expect(first.body.id).toBe(second.body.id);
  });
});
