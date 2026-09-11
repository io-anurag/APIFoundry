import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/users`;

describe("Users resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("CRUD lifecycle (User Story 1)", () => {
    it("supports create -> get -> list -> put -> patch -> delete -> 404", async () => {
      const createRes = await request(app)
        .post(BASE)
        .send({ name: "Ada Lovelace", email: "ada@example.com", role: "user" });
      expect(createRes.status).toBe(201);
      expect(createRes.body).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com", role: "user" });
      expect(typeof createRes.body.id).toBe("number");
      const id = createRes.body.id;

      const getRes = await request(app).get(`${BASE}/${id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(id);

      const listRes = await request(app).get(BASE);
      expect(listRes.status).toBe(200);
      expect(listRes.body.pagination.total).toBeGreaterThanOrEqual(51);

      const putRes = await request(app)
        .put(`${BASE}/${id}`)
        .send({ name: "Ada L.", email: "ada.l@example.com", role: "admin" });
      expect(putRes.status).toBe(200);
      expect(putRes.body).toMatchObject({ name: "Ada L.", email: "ada.l@example.com", role: "admin" });

      const patchRes = await request(app).patch(`${BASE}/${id}`).send({ status: "inactive" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe("inactive");
      expect(patchRes.body.name).toBe("Ada L.");

      const deleteRes = await request(app).delete(`${BASE}/${id}`);
      expect(deleteRes.status).toBe(204);

      const afterDeleteRes = await request(app).get(`${BASE}/${id}`);
      expect(afterDeleteRes.status).toBe(404);
      expect(afterDeleteRes.body.error.code).toBe("RESOURCE_NOT_FOUND");
    });

    it("seeds at least 50 deterministic users (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(50);
    });

    it("carries X-Request-ID on success and error responses (FR-016)", async () => {
      const okRes = await request(app).get(`${BASE}/1`);
      expect(okRes.headers["x-request-id"]).toBeTruthy();

      const errRes = await request(app).get(`${BASE}/999999`);
      expect(errRes.headers["x-request-id"]).toBeTruthy();
      expect(errRes.body.error.requestId).toBe(errRes.headers["x-request-id"]);
    });
  });

  describe("Validation rejection (User Story 2)", () => {
    it("rejects a missing required field", async () => {
      const res = await request(app).post(BASE).send({ email: "x@example.com", role: "user" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects the wrong type for a field", async () => {
      const res = await request(app).post(BASE).send({ name: "X", email: "x@example.com", role: 123 });
      expect(res.status).toBe(400);
    });

    it("rejects an invalid email format", async () => {
      const res = await request(app).post(BASE).send({ name: "X", email: "not-an-email", role: "user" });
      expect(res.status).toBe(400);
    });

    it("rejects an invalid role enum value (FR-017)", async () => {
      const res = await request(app).post(BASE).send({ name: "X", email: "x@example.com", role: "superuser" });
      expect(res.status).toBe(400);
    });

    it("rejects null in a required field", async () => {
      const res = await request(app).post(BASE).send({ name: null, email: "x@example.com", role: "user" });
      expect(res.status).toBe(400);
    });

    it("rejects an empty string for name", async () => {
      const res = await request(app).post(BASE).send({ name: "", email: "x@example.com", role: "user" });
      expect(res.status).toBe(400);
    });

    it("rejects an unexpected extra field", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ name: "X", email: "x@example.com", role: "user", notAField: true });
      expect(res.status).toBe(400);
    });

    it("never applies a client-supplied id (rejects it as an unrecognized field, FR-014)", async () => {
      const res = await request(app)
        .patch(`${BASE}/1`)
        .send({ id: 999, name: "Changed" });
      expect(res.status).toBe(400);

      const unchanged = await request(app).get(`${BASE}/1`);
      expect(unchanged.body.id).toBe(1);
    });

    it("rejects a PUT sent with a partial body (Edge Cases)", async () => {
      const res = await request(app).put(`${BASE}/1`).send({ name: "Only Name" });
      expect(res.status).toBe(400);
    });

    it("does not create a record or mutate data on any rejected write", async () => {
      const before = await request(app).get(`${BASE}?limit=1`);
      await request(app).post(BASE).send({});
      const after = await request(app).get(`${BASE}?limit=1`);
      expect(after.body.pagination.total).toBe(before.body.pagination.total);
    });
  });

  describe("Path parameter edge cases (User Story 3)", () => {
    it("returns 404 for a valid but nonexistent id", async () => {
      const res = await request(app).get(`${BASE}/999999`);
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed (non-numeric) id", async () => {
      const res = await request(app).get(`${BASE}/abc`);
      expect(res.status).toBe(400);
    });

    it("returns 400 for a negative id", async () => {
      const res = await request(app).get(`${BASE}/-1`);
      expect(res.status).toBe(400);
    });

    it("returns 400 for a zero id", async () => {
      const res = await request(app).get(`${BASE}/0`);
      expect(res.status).toBe(400);
    });

    it("returns 400 for a huge id", async () => {
      const res = await request(app).get(`${BASE}/99999999999999999999`);
      expect(res.status).toBe(400);
    });

    it("returns 404 for an empty id segment, never 500", async () => {
      const res = await request(app).get(`${BASE}/`);
      expect(res.status).toBe(404);
    });

    it("returns 404 on a second DELETE for the same id, not a repeated success", async () => {
      const first = await request(app).delete(`${BASE}/2`);
      expect(first.status).toBe(204);
      const second = await request(app).delete(`${BASE}/2`);
      expect(second.status).toBe(404);
    });

    it("never returns 500 for any of the above", async () => {
      const ids = ["999999", "abc", "-1", "0", "99999999999999999999"];
      for (const id of ids) {
        const res = await request(app).get(`${BASE}/${id}`);
        expect(res.status).not.toBe(500);
      }
    });
  });

  describe("Pagination, sorting, filtering (User Story 4)", () => {
    it("returns the correct page with accurate pagination metadata", async () => {
      const res = await request(app).get(`${BASE}?page=2&limit=10`);
      expect(res.status).toBe(200);
      expect(res.body.pagination).toMatchObject({ page: 2, limit: 10 });
      expect(res.body.data.length).toBeLessThanOrEqual(10);
      expect(res.body.pagination.totalPages).toBe(Math.ceil(res.body.pagination.total / 10));
      expect(res.body.pagination.hasPrevious).toBe(true);
    });

    it("rejects page=0 with 400 (FR-008)", async () => {
      const res = await request(app).get(`${BASE}?page=0`);
      expect(res.status).toBe(400);
    });

    it("rejects a negative or non-numeric limit with 400 (FR-008)", async () => {
      const negative = await request(app).get(`${BASE}?limit=-5`);
      expect(negative.status).toBe(400);
      const nonNumeric = await request(app).get(`${BASE}?limit=abc`);
      expect(nonNumeric.status).toBe(400);
    });

    it("sorts ascending and descending by name (FR-009)", async () => {
      const asc = await request(app).get(`${BASE}?sort=name&limit=100`);
      const names = asc.body.data.map((u: { name: string }) => u.name);
      expect(names).toEqual([...names].sort());

      const desc = await request(app).get(`${BASE}?sort=-name&limit=100`);
      const namesDesc = desc.body.data.map((u: { name: string }) => u.name);
      expect(namesDesc).toEqual([...namesDesc].sort().reverse());
    });

    it("rejects an unknown sort field with 400 (FR-009)", async () => {
      const res = await request(app).get(`${BASE}?sort=notAField`);
      expect(res.status).toBe(400);
    });

    it("filters by role, alone and combined with pagination/sort (FR-010)", async () => {
      const res = await request(app).get(`${BASE}?role=admin&limit=100`);
      expect(res.status).toBe(200);
      for (const user of res.body.data) {
        expect(user.role).toBe("admin");
      }

      const combined = await request(app).get(`${BASE}?role=admin&sort=name&page=1&limit=5`);
      expect(combined.status).toBe(200);
      for (const user of combined.body.data) {
        expect(user.role).toBe("admin");
      }
    });

    it("resolves a repeated conflicting filter parameter deterministically (Edge Cases)", async () => {
      const first = await request(app).get(`${BASE}?role=admin&role=manager`);
      const second = await request(app).get(`${BASE}?role=admin&role=manager`);
      expect(first.body.data).toEqual(second.body.data);
    });
  });
});
