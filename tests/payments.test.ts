import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/payments`;

describe("Payments resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("Read-only catalog (User Story 1)", () => {
    it("seeds exactly one payment per seeded order (FR-002)", async () => {
      const orders = await request(app).get(`${config.apiPrefix}/orders?limit=1`);
      const payments = await request(app).get(`${BASE}?limit=1`);
      expect(payments.status).toBe(200);
      expect(payments.body.pagination.total).toBe(orders.body.pagination.total);
    });

    it("gets a known seeded payment by id", async () => {
      const list = await request(app).get(`${BASE}?limit=1`);
      const id = list.body.data[0].id;

      const res = await request(app).get(`${BASE}/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it("returns 404 for a well-formed but unknown UUID", async () => {
      const res = await request(app).get(`${BASE}/00000000-0000-4000-8000-000000000000`);
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed UUID", async () => {
      const res = await request(app).get(`${BASE}/not-a-uuid`);
      expect(res.status).toBe(400);
    });

    it("carries X-Request-ID on success and error responses", async () => {
      const list = await request(app).get(`${BASE}?limit=1`);
      const id = list.body.data[0].id;

      const okRes = await request(app).get(`${BASE}/${id}`);
      expect(okRes.headers["x-request-id"]).toBeTruthy();

      const errRes = await request(app).get(`${BASE}/00000000-0000-4000-8000-000000000000`);
      expect(errRes.headers["x-request-id"]).toBeTruthy();
      expect(errRes.body.error.requestId).toBe(errRes.headers["x-request-id"]);
    });

    it("returns 405 for unsupported write methods on the collection and single-record URLs", async () => {
      // POST /payments is a supported write (idempotent creation, Spec 008) — covered separately
      // in tests/paymentsIdempotency.test.ts — so only PUT/PATCH/DELETE remain unsupported here.
      const list = await request(app).get(`${BASE}?limit=1`);
      const id = list.body.data[0].id;

      const putRes = await request(app).put(`${BASE}/${id}`).send({});
      expect(putRes.status).toBe(405);

      const patchRes = await request(app).patch(`${BASE}/${id}`).send({});
      expect(patchRes.status).toBe(405);

      const deleteRes = await request(app).delete(`${BASE}/${id}`);
      expect(deleteRes.status).toBe(405);
    });
  });

  describe("payments/by-date/:date (User Story 3)", () => {
    it("returns only payments processed on the given date", async () => {
      const list = await request(app).get(`${BASE}?limit=1`);
      const knownDate = list.body.data[0].processedAt;

      const res = await request(app).get(`${BASE}/by-date/${knownDate}`);
      expect(res.status).toBe(200);
      for (const payment of res.body.data) {
        expect(payment.processedAt).toBe(knownDate);
      }
    });

    it("returns 200 with empty data for a date with no payments", async () => {
      const res = await request(app).get(`${BASE}/by-date/2099-01-01`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("returns 400 for a malformed date", async () => {
      const res = await request(app).get(`${BASE}/by-date/not-a-date`);
      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid calendar date", async () => {
      const badMonth = await request(app).get(`${BASE}/by-date/2026-13-01`);
      expect(badMonth.status).toBe(400);

      const badDay = await request(app).get(`${BASE}/by-date/2026-02-30`);
      expect(badDay.status).toBe(400);
    });

    it("returns 400 for additional malformed UUID variants on the top-level id, never 500", async () => {
      const variants = ["12345", "00000000-0000-0000-0000", "gggggggg-0000-4000-8000-000000000000"];
      for (const id of variants) {
        const res = await request(app).get(`${BASE}/${id}`);
        expect(res.status).toBe(400);
      }
    });
  });
});
