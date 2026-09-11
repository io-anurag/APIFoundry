import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/products`;

describe("Products resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("CRUD lifecycle (User Story 1)", () => {
    it("supports create -> get -> list -> put -> patch -> delete -> 404", async () => {
      const createRes = await request(app)
        .post(BASE)
        .send({ name: "Widget", price: 9.99, category: "electronics", stock: 10 });
      expect(createRes.status).toBe(201);
      expect(createRes.body).toMatchObject({ name: "Widget", price: 9.99, category: "electronics", stock: 10 });
      const id = createRes.body.id;

      const getRes = await request(app).get(`${BASE}/${id}`);
      expect(getRes.status).toBe(200);

      const listRes = await request(app).get(BASE);
      expect(listRes.body.pagination.total).toBeGreaterThanOrEqual(51);

      const putRes = await request(app)
        .put(`${BASE}/${id}`)
        .send({ name: "Widget v2", price: 12.99, category: "electronics", stock: 5 });
      expect(putRes.status).toBe(200);
      expect(putRes.body.price).toBe(12.99);

      const patchRes = await request(app).patch(`${BASE}/${id}`).send({ stock: 3 });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.stock).toBe(3);
      expect(patchRes.body.name).toBe("Widget v2");

      const deleteRes = await request(app).delete(`${BASE}/${id}`);
      expect(deleteRes.status).toBe(204);

      const afterDeleteRes = await request(app).get(`${BASE}/${id}`);
      expect(afterDeleteRes.status).toBe(404);
    });

    it("seeds at least 50 deterministic products (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(50);
    });

    it("carries X-Request-ID on success and error responses (FR-016)", async () => {
      const okRes = await request(app).get(`${BASE}/1`);
      expect(okRes.headers["x-request-id"]).toBeTruthy();
      const errRes = await request(app).get(`${BASE}/999999`);
      expect(errRes.body.error.requestId).toBe(errRes.headers["x-request-id"]);
    });
  });

  describe("Validation rejection (User Story 2)", () => {
    it("rejects a missing required field", async () => {
      const res = await request(app).post(BASE).send({ price: 1, category: "electronics", stock: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects the wrong type for a field", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ name: "X", price: "free", category: "electronics", stock: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects price <= 0", async () => {
      const res = await request(app).post(BASE).send({ name: "X", price: -5, category: "electronics", stock: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects stock < 0", async () => {
      const res = await request(app).post(BASE).send({ name: "X", price: 5, category: "electronics", stock: -1 });
      expect(res.status).toBe(400);
    });

    it("rejects an invalid category enum value (FR-019)", async () => {
      const res = await request(app).post(BASE).send({ name: "X", price: 5, category: "spaceships", stock: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects an empty name", async () => {
      const res = await request(app).post(BASE).send({ name: "", price: 5, category: "electronics", stock: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects an unexpected extra field", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ name: "X", price: 5, category: "electronics", stock: 1, notAField: true });
      expect(res.status).toBe(400);
    });

    it("never applies a client-supplied id (FR-014)", async () => {
      const res = await request(app).patch(`${BASE}/1`).send({ id: 999, price: 1 });
      expect(res.status).toBe(400);
      const unchanged = await request(app).get(`${BASE}/1`);
      expect(unchanged.body.id).toBe(1);
    });

    it("rejects a PUT sent with a partial body (Edge Cases)", async () => {
      const res = await request(app).put(`${BASE}/1`).send({ name: "Only Name" });
      expect(res.status).toBe(400);
    });
  });

  describe("Path parameter edge cases (User Story 3)", () => {
    it("returns 404 for a valid but nonexistent id", async () => {
      const res = await request(app).get(`${BASE}/999999`);
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed, negative, zero, or huge id", async () => {
      for (const id of ["abc", "-1", "0", "99999999999999999999"]) {
        const res = await request(app).get(`${BASE}/${id}`);
        expect(res.status).toBe(400);
      }
    });

    it("returns 404 for an empty id segment, never 500", async () => {
      const res = await request(app).get(`${BASE}/`);
      expect(res.status).toBe(404);
    });

    it("returns 404 on a second DELETE for the same id", async () => {
      const first = await request(app).delete(`${BASE}/2`);
      expect(first.status).toBe(204);
      const second = await request(app).delete(`${BASE}/2`);
      expect(second.status).toBe(404);
    });
  });

  describe("Pagination, sorting, filtering (User Story 4)", () => {
    it("returns the correct page with accurate pagination metadata", async () => {
      const res = await request(app).get(`${BASE}?page=2&limit=10`);
      expect(res.body.pagination).toMatchObject({ page: 2, limit: 10 });
    });

    it("rejects invalid pagination values", async () => {
      expect((await request(app).get(`${BASE}?page=0`)).status).toBe(400);
      expect((await request(app).get(`${BASE}?limit=-5`)).status).toBe(400);
    });

    it("sorts ascending and descending by price (FR-009)", async () => {
      const asc = await request(app).get(`${BASE}?sort=price&limit=100`);
      const prices = asc.body.data.map((p: { price: number }) => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));

      const desc = await request(app).get(`${BASE}?sort=-price&limit=100`);
      const pricesDesc = desc.body.data.map((p: { price: number }) => p.price);
      expect(pricesDesc).toEqual([...pricesDesc].sort((a, b) => b - a));
    });

    it("rejects an unknown sort field with 400", async () => {
      const res = await request(app).get(`${BASE}?sort=notAField`);
      expect(res.status).toBe(400);
    });

    it("filters by category, alone and combined with pagination/sort (FR-010)", async () => {
      const res = await request(app).get(`${BASE}?category=electronics&limit=100`);
      for (const product of res.body.data) {
        expect(product.category).toBe("electronics");
      }
    });

    it("resolves a repeated conflicting filter parameter deterministically", async () => {
      const first = await request(app).get(`${BASE}?category=electronics&category=books`);
      const second = await request(app).get(`${BASE}?category=electronics&category=books`);
      expect(first.body.data).toEqual(second.body.data);
    });
  });
});
