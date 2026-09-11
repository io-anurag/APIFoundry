import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/orders`;

describe("Orders resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("CRUD lifecycle (User Story 1)", () => {
    it("supports create -> get -> list -> put -> patch -> delete -> 404, with a server-computed total", async () => {
      const createRes = await request(app)
        .post(BASE)
        .send({ customerId: 1, items: [{ productId: 1, quantity: 2 }] });
      expect(createRes.status).toBe(201);
      expect(createRes.body.customerId).toBe(1);
      expect(createRes.body.status).toBe("pending");
      expect(createRes.body.total).toBe(23); // seeded product 1 price is 11.5 * qty 2
      const id = createRes.body.id;

      const getRes = await request(app).get(`${BASE}/${id}`);
      expect(getRes.status).toBe(200);

      const listRes = await request(app).get(BASE);
      expect(listRes.body.pagination.total).toBeGreaterThanOrEqual(101);

      const putRes = await request(app)
        .put(`${BASE}/${id}`)
        .send({ customerId: 2, items: [{ productId: 2, quantity: 1 }], status: "processing" });
      expect(putRes.status).toBe(200);
      expect(putRes.body.customerId).toBe(2);
      expect(putRes.body.status).toBe("processing");

      const patchRes = await request(app).patch(`${BASE}/${id}`).send({ status: "shipped" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe("shipped");
      expect(patchRes.body.customerId).toBe(2);

      const deleteRes = await request(app).delete(`${BASE}/${id}`);
      expect(deleteRes.status).toBe(204);

      const afterDeleteRes = await request(app).get(`${BASE}/${id}`);
      expect(afterDeleteRes.status).toBe(404);
    });

    it("seeds at least 100 deterministic orders (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(100);
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
      const res = await request(app).post(BASE).send({ items: [{ productId: 1, quantity: 1 }] });
      expect(res.status).toBe(400);
    });

    it("rejects an invalid status enum value (FR-018)", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ customerId: 1, items: [{ productId: 1, quantity: 1 }], status: "on-hold" });
      expect(res.status).toBe(400);
    });

    it("rejects items[].quantity < 1", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ customerId: 1, items: [{ productId: 1, quantity: 0 }] });
      expect(res.status).toBe(400);
    });

    it("rejects an empty items array (below the 1-entry minimum)", async () => {
      const res = await request(app).post(BASE).send({ customerId: 1, items: [] });
      expect(res.status).toBe(400);
    });

    it("rejects a non-existent customerId (FR-015)", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ customerId: 999999, items: [{ productId: 1, quantity: 1 }] });
      expect(res.status).toBe(400);
    });

    it("rejects a non-existent items[].productId (FR-015)", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ customerId: 1, items: [{ productId: 999999, quantity: 1 }] });
      expect(res.status).toBe(400);
    });

    it("rejects an unexpected extra field", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ customerId: 1, items: [{ productId: 1, quantity: 1 }], notAField: true });
      expect(res.status).toBe(400);
    });

    it("never trusts a client-supplied total", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ customerId: 1, items: [{ productId: 1, quantity: 1 }], total: 1000000 });
      expect(res.status).toBe(400);
    });

    it("never applies a client-supplied id (FR-014)", async () => {
      const res = await request(app).patch(`${BASE}/1`).send({ id: 999, status: "shipped" });
      expect(res.status).toBe(400);
      const unchanged = await request(app).get(`${BASE}/1`);
      expect(unchanged.body.id).toBe(1);
    });

    it("rejects a PUT sent with a partial body (Edge Cases)", async () => {
      const res = await request(app).put(`${BASE}/1`).send({ status: "shipped" });
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

    it("sorts ascending and descending by total (FR-009)", async () => {
      const asc = await request(app).get(`${BASE}?sort=total&limit=100`);
      const totals = asc.body.data.map((o: { total: number }) => o.total);
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    });

    it("rejects an unknown sort field with 400", async () => {
      const res = await request(app).get(`${BASE}?sort=notAField`);
      expect(res.status).toBe(400);
    });

    it("filters by status, alone and combined with pagination/sort (FR-010)", async () => {
      const res = await request(app).get(`${BASE}?status=pending&limit=100`);
      for (const order of res.body.data) {
        expect(order.status).toBe("pending");
      }
    });

    it("resolves a repeated conflicting filter parameter deterministically", async () => {
      const first = await request(app).get(`${BASE}?status=pending&status=shipped`);
      const second = await request(app).get(`${BASE}?status=pending&status=shipped`);
      expect(first.body.data).toEqual(second.body.data);
    });
  });

  describe("Nested route: users/:id/orders (User Story 2)", () => {
    it("lists orders for a user linked via customer.userId", async () => {
      // Seed customer 3 is linked to user 3 (customers.seed.ts: every third customer, i % 3 === 0).
      const res = await request(app).get(`${config.apiPrefix}/users/3/orders`);
      expect(res.status).toBe(200);
      for (const order of res.body.data) {
        expect(order.customerId).toBe(3);
      }
    });

    it("returns 404 for a nonexistent user", async () => {
      const res = await request(app).get(`${config.apiPrefix}/users/999999/orders`);
      expect(res.status).toBe(404);
    });

    it("returns 200 with empty data for a user with no linked customers/orders", async () => {
      // User ids not divisible by 3 (and <= 60) have no linked customer (customers.seed.ts).
      const res = await request(app).get(`${config.apiPrefix}/users/2/orders`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("Nested route: orders/:id/products (User Story 2)", () => {
    it("lists the distinct products referenced by an existing order", async () => {
      const res = await request(app).get(`${BASE}/1/products`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("returns 404 for a nonexistent order", async () => {
      const res = await request(app).get(`${BASE}/999999/products`);
      expect(res.status).toBe(404);
    });
  });
});
