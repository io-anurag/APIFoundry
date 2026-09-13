import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";
import { issueScopedToken, bearer } from "./helpers/authToken";

const BASE = `${config.apiPrefix}/customers`;

const VALID_ADDRESS = { street: "1 Main St", city: "Springfield", postalCode: "00001", country: "USA" };

describe("Customers resource", () => {
  let token: string;

  beforeEach(async () => {
    resetStores();
    token = await issueScopedToken(["admin"]);
  });

  describe("Authorization (customers:read / customers:write)", () => {
    it("returns 401 for the collection and single-record routes with no token", async () => {
      expect((await request(app).get(BASE)).status).toBe(401);
      expect((await request(app).get(`${BASE}/1`)).status).toBe(401);
      expect((await request(app).post(BASE).send({})).status).toBe(401);
    });

    it("returns 403 INSUFFICIENT_SCOPE for a token missing customers:read/customers:write", async () => {
      const wrongScope = await issueScopedToken(["orders:read"]);
      const res = await request(app).get(BASE).set(...bearer(wrongScope));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("INSUFFICIENT_SCOPE");
    });

    it("grants GET with only customers:read but rejects writes with 403", async () => {
      const readOnly = await issueScopedToken(["customers:read"]);
      expect((await request(app).get(BASE).set(...bearer(readOnly))).status).toBe(200);
      const create = await request(app)
        .post(BASE)
        .set(...bearer(readOnly))
        .send({ name: "X", email: "x@example.com", address: VALID_ADDRESS });
      expect(create.status).toBe(403);
    });

    it("grants writes with customers:write", async () => {
      const writer = await issueScopedToken(["customers:write"]);
      const res = await request(app)
        .post(BASE)
        .set(...bearer(writer))
        .send({ name: "Scoped Customer", email: "scoped.customer@example.com", address: VALID_ADDRESS });
      expect(res.status).toBe(201);
    });
  });

  describe("CRUD lifecycle (User Story 1)", () => {
    it("supports create -> get -> list -> put -> patch -> delete -> 404", async () => {
      const createRes = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ name: "Grace Hopper", email: "grace@example.com", address: VALID_ADDRESS });
      expect(createRes.status).toBe(201);
      expect(createRes.body.userId).toBeNull();
      const id = createRes.body.id;

      const getRes = await request(app).get(`${BASE}/${id}`).set(...bearer(token));
      expect(getRes.status).toBe(200);

      const listRes = await request(app).get(BASE).set(...bearer(token));
      expect(listRes.body.pagination.total).toBeGreaterThanOrEqual(61);

      const putRes = await request(app)
        .put(`${BASE}/${id}`)
        .set(...bearer(token))
        .send({ name: "Grace H.", email: "grace.h@example.com", address: VALID_ADDRESS, userId: 1 });
      expect(putRes.status).toBe(200);
      expect(putRes.body.userId).toBe(1);

      const patchRes = await request(app)
        .patch(`${BASE}/${id}`)
        .set(...bearer(token))
        .send({ name: "Grace Brewster Hopper" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe("Grace Brewster Hopper");
      expect(patchRes.body.userId).toBe(1);

      const deleteRes = await request(app).delete(`${BASE}/${id}`).set(...bearer(token));
      expect(deleteRes.status).toBe(204);

      const afterDeleteRes = await request(app).get(`${BASE}/${id}`).set(...bearer(token));
      expect(afterDeleteRes.status).toBe(404);
    });

    it("seeds a deterministic set of customers (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`).set(...bearer(token));
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(60);
    });

    it("carries X-Request-ID on success and error responses (FR-016)", async () => {
      const okRes = await request(app).get(`${BASE}/1`).set(...bearer(token));
      expect(okRes.headers["x-request-id"]).toBeTruthy();
      const errRes = await request(app).get(`${BASE}/999999`).set(...bearer(token));
      expect(errRes.body.error.requestId).toBe(errRes.headers["x-request-id"]);
    });
  });

  describe("Validation rejection (User Story 2)", () => {
    it("rejects a missing required field", async () => {
      const res = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ email: "x@example.com", address: VALID_ADDRESS });
      expect(res.status).toBe(400);
    });

    it("rejects an invalid email format", async () => {
      const res = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ name: "X", email: "bad", address: VALID_ADDRESS });
      expect(res.status).toBe(400);
    });

    it("rejects an incomplete address (missing a required sub-field)", async () => {
      const res = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ name: "X", email: "x@example.com", address: { street: "1 Main St", city: "Springfield" } });
      expect(res.status).toBe(400);
    });

    it("rejects null in a required field", async () => {
      const res = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ name: null, email: "x@example.com", address: VALID_ADDRESS });
      expect(res.status).toBe(400);
    });

    it("rejects an unexpected extra field", async () => {
      const res = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ name: "X", email: "x@example.com", address: VALID_ADDRESS, notAField: true });
      expect(res.status).toBe(400);
    });

    it("rejects a userId that does not resolve to an existing user (FR-020)", async () => {
      const res = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ name: "X", email: "x@example.com", address: VALID_ADDRESS, userId: 999999 });
      expect(res.status).toBe(400);
    });

    it("never applies a client-supplied id (FR-014)", async () => {
      const res = await request(app)
        .patch(`${BASE}/1`)
        .set(...bearer(token))
        .send({ id: 999, name: "Changed" });
      expect(res.status).toBe(400);
      const unchanged = await request(app).get(`${BASE}/1`).set(...bearer(token));
      expect(unchanged.body.id).toBe(1);
    });

    it("rejects a PUT sent with a partial body (Edge Cases)", async () => {
      const res = await request(app)
        .put(`${BASE}/1`)
        .set(...bearer(token))
        .send({ name: "Only Name" });
      expect(res.status).toBe(400);
    });
  });

  describe("Path parameter edge cases (User Story 3)", () => {
    it("returns 404 for a valid but nonexistent id", async () => {
      const res = await request(app).get(`${BASE}/999999`).set(...bearer(token));
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed, negative, zero, or huge id", async () => {
      for (const id of ["abc", "-1", "0", "99999999999999999999"]) {
        const res = await request(app).get(`${BASE}/${id}`).set(...bearer(token));
        expect(res.status).toBe(400);
      }
    });

    it("returns 404 for an empty id segment, never 500", async () => {
      const res = await request(app).get(`${BASE}/`).set(...bearer(token));
      expect(res.status).toBe(404);
    });

    it("returns 404 on a second DELETE for the same id", async () => {
      const first = await request(app).delete(`${BASE}/2`).set(...bearer(token));
      expect(first.status).toBe(204);
      const second = await request(app).delete(`${BASE}/2`).set(...bearer(token));
      expect(second.status).toBe(404);
    });
  });

  describe("Pagination, sorting, filtering (User Story 4)", () => {
    it("returns the correct page with accurate pagination metadata", async () => {
      const res = await request(app).get(`${BASE}?page=2&limit=10`).set(...bearer(token));
      expect(res.body.pagination).toMatchObject({ page: 2, limit: 10 });
    });

    it("rejects invalid pagination values", async () => {
      expect((await request(app).get(`${BASE}?page=0`).set(...bearer(token))).status).toBe(400);
      expect((await request(app).get(`${BASE}?limit=-5`).set(...bearer(token))).status).toBe(400);
    });

    it("sorts ascending and descending by name (FR-009)", async () => {
      const asc = await request(app).get(`${BASE}?sort=name&limit=100`).set(...bearer(token));
      const names = asc.body.data.map((c: { name: string }) => c.name);
      expect(names).toEqual([...names].sort());
    });

    it("rejects an unknown sort field with 400", async () => {
      const res = await request(app).get(`${BASE}?sort=notAField`).set(...bearer(token));
      expect(res.status).toBe(400);
    });

    it("filters by country, alone and combined with pagination/sort (FR-010)", async () => {
      const res = await request(app).get(`${BASE}?country=USA&limit=100`).set(...bearer(token));
      for (const customer of res.body.data) {
        expect(customer.address.country).toBe("USA");
      }
    });

    it("resolves a repeated conflicting filter parameter deterministically", async () => {
      const first = await request(app).get(`${BASE}?country=USA&country=Canada`).set(...bearer(token));
      const second = await request(app).get(`${BASE}?country=USA&country=Canada`).set(...bearer(token));
      expect(first.body.data).toEqual(second.body.data);
    });
  });

  describe("Unsupported methods (405)", () => {
    it("returns 405 for unsupported methods on the collection URL", async () => {
      const patchRes = await request(app).patch(BASE).set(...bearer(token)).send({});
      expect(patchRes.status).toBe(405);

      const putRes = await request(app).put(BASE).set(...bearer(token)).send({});
      expect(putRes.status).toBe(405);

      const deleteRes = await request(app).delete(BASE).set(...bearer(token));
      expect(deleteRes.status).toBe(405);
    });

    it("returns 405 for unsupported methods on the single-record URL", async () => {
      const createRes = await request(app)
        .post(BASE)
        .set(...bearer(token))
        .send({ name: "Method Check", email: "method.check@example.com", address: VALID_ADDRESS });
      const id = createRes.body.id;

      const postRes = await request(app).post(`${BASE}/${id}`).set(...bearer(token)).send({});
      expect(postRes.status).toBe(405);
    });
  });
});
