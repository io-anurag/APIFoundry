import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/categories`;

describe("Categories resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("Read-only catalog (User Story 1)", () => {
    it("seeds at least 20 deterministic categories (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(20);
    });

    it("gets a known seeded category by slug", async () => {
      const res = await request(app).get(`${BASE}/electronics`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("electronics");
    });

    it("returns 404 for an unknown but well-formed slug", async () => {
      const res = await request(app).get(`${BASE}/not-a-real-category`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
    });

    it("returns 400 for a malformed slug", async () => {
      const uppercase = await request(app).get(`${BASE}/Electronics`);
      expect(uppercase.status).toBe(400);

      const underscore = await request(app).get(`${BASE}/not_a_slug`);
      expect(underscore.status).toBe(400);
    });

    it("carries X-Request-ID on success and error responses", async () => {
      const okRes = await request(app).get(`${BASE}/electronics`);
      expect(okRes.headers["x-request-id"]).toBeTruthy();

      const errRes = await request(app).get(`${BASE}/not-a-real-category`);
      expect(errRes.headers["x-request-id"]).toBeTruthy();
      expect(errRes.body.error.requestId).toBe(errRes.headers["x-request-id"]);
    });

    it("returns 405 for write methods on the collection and single-record URLs", async () => {
      const postRes = await request(app).post(BASE).send({});
      expect(postRes.status).toBe(405);

      const putRes = await request(app).put(`${BASE}/electronics`).send({});
      expect(putRes.status).toBe(405);

      const patchRes = await request(app).patch(`${BASE}/electronics`).send({});
      expect(patchRes.status).toBe(405);

      const deleteRes = await request(app).delete(`${BASE}/electronics`);
      expect(deleteRes.status).toBe(405);
    });
  });

  describe("Path parameter type diversity (User Story 3)", () => {
    it("returns 400 for additional malformed slug variants, never 500", async () => {
      const variants = ["leading-", "-trailing", "double--hyphen"];
      for (const slug of variants) {
        const res = await request(app).get(`${BASE}/${slug}`);
        expect(res.status).toBe(400);
      }
    });

    it("returns 404 for an empty slug segment, never 500", async () => {
      const res = await request(app).get(`${BASE}/`);
      expect(res.status).toBe(404);
    });
  });

  describe("Nested route: products/:id/category (User Story 2)", () => {
    it("returns the matching category for an existing product", async () => {
      const res = await request(app).get(`${config.apiPrefix}/products/1/category`);
      expect(res.status).toBe(200);
      expect(typeof res.body.id).toBe("string");
    });

    it("returns 404 for a nonexistent product", async () => {
      const res = await request(app).get(`${config.apiPrefix}/products/999999/category`);
      expect(res.status).toBe(404);
    });
  });
});
