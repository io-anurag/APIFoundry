import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/reviews`;

describe("Reviews resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("Read-only catalog (User Story 1)", () => {
    it("seeds at least 100 deterministic reviews (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(100);
    });

    it("gets a known seeded review by id", async () => {
      const res = await request(app).get(`${BASE}/1`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    it("returns 404 for a valid but nonexistent id", async () => {
      const res = await request(app).get(`${BASE}/999999`);
      expect(res.status).toBe(404);
    });

    it("returns 400 for malformed/negative/zero/huge ids", async () => {
      for (const id of ["abc", "-1", "0", "99999999999999999999"]) {
        const res = await request(app).get(`${BASE}/${id}`);
        expect(res.status).toBe(400);
      }
    });

    it("carries X-Request-ID on success and error responses", async () => {
      const okRes = await request(app).get(`${BASE}/1`);
      expect(okRes.headers["x-request-id"]).toBeTruthy();

      const errRes = await request(app).get(`${BASE}/999999`);
      expect(errRes.headers["x-request-id"]).toBeTruthy();
      expect(errRes.body.error.requestId).toBe(errRes.headers["x-request-id"]);
    });

    it("returns 405 for write methods on the collection and single-record URLs", async () => {
      const postRes = await request(app).post(BASE).send({});
      expect(postRes.status).toBe(405);

      const putRes = await request(app).put(`${BASE}/1`).send({});
      expect(putRes.status).toBe(405);

      const patchRes = await request(app).patch(`${BASE}/1`).send({});
      expect(patchRes.status).toBe(405);

      const deleteRes = await request(app).delete(`${BASE}/1`);
      expect(deleteRes.status).toBe(405);
    });
  });

  describe("Nested route: products/:id/reviews (User Story 2)", () => {
    it("lists reviews for an existing product", async () => {
      const res = await request(app).get(`${config.apiPrefix}/products/1/reviews`);
      expect(res.status).toBe(200);
      for (const review of res.body.data) {
        expect(review.productId).toBe(1);
      }
    });

    it("returns 404 for a nonexistent product", async () => {
      const res = await request(app).get(`${config.apiPrefix}/products/999999/reviews`);
      expect(res.status).toBe(404);
    });

    it("returns 200 with empty data for a product with no reviews", async () => {
      const res = await request(app).get(`${config.apiPrefix}/products/50/reviews`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("reviews/by-rating/:rating (User Story 3)", () => {
    it("returns only reviews matching each rating 1-5", async () => {
      for (const rating of [1, 2, 3, 4, 5]) {
        const res = await request(app).get(`${BASE}/by-rating/${rating}`);
        expect(res.status).toBe(200);
        for (const review of res.body.data) {
          expect(review.rating).toBe(rating);
        }
      }
    });

    it("returns 400 for an out-of-range or non-integer rating", async () => {
      for (const rating of ["0", "6", "3.5", "abc"]) {
        const res = await request(app).get(`${BASE}/by-rating/${rating}`);
        expect(res.status).toBe(400);
      }
    });
  });
});
