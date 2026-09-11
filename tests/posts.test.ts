import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/posts`;

describe("Posts resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("Read-only catalog (User Story 1)", () => {
    it("seeds at least 100 deterministic posts (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(100);
    });

    it("gets a known seeded post by id", async () => {
      const list = await request(app).get(`${BASE}?limit=1`);
      const id = list.body.data[0].id;

      const res = await request(app).get(`${BASE}/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it("returns 404 for a well-formed but unknown UUID", async () => {
      const res = await request(app).get(`${BASE}/00000000-0000-4000-8000-000000000000`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
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

    it("returns 405 for write methods on the collection and single-record URLs", async () => {
      const list = await request(app).get(`${BASE}?limit=1`);
      const id = list.body.data[0].id;

      const postRes = await request(app).post(BASE).send({});
      expect(postRes.status).toBe(405);

      const putRes = await request(app).put(`${BASE}/${id}`).send({});
      expect(putRes.status).toBe(405);

      const patchRes = await request(app).patch(`${BASE}/${id}`).send({});
      expect(patchRes.status).toBe(405);

      const deleteRes = await request(app).delete(`${BASE}/${id}`);
      expect(deleteRes.status).toBe(405);
    });
  });

  describe("Path parameter type diversity (User Story 3)", () => {
    it("returns 400 for additional malformed UUID variants, never 500", async () => {
      const variants = ["12345", "00000000-0000-0000-0000", "gggggggg-0000-4000-8000-000000000000"];
      for (const id of variants) {
        const res = await request(app).get(`${BASE}/${id}`);
        expect(res.status).toBe(400);
      }
    });

    it("returns 404 for an empty id segment, never 500", async () => {
      const res = await request(app).get(`${BASE}/`);
      expect(res.status).toBe(404);
    });
  });

  describe("Nested route: users/:id/posts (User Story 2)", () => {
    it("lists posts authored by an existing user", async () => {
      const res = await request(app).get(`${config.apiPrefix}/users/1/posts`);
      expect(res.status).toBe(200);
      for (const post of res.body.data) {
        expect(post.userId).toBe(1);
      }
    });

    it("returns 404 for a nonexistent user", async () => {
      const res = await request(app).get(`${config.apiPrefix}/users/999999/posts`);
      expect(res.status).toBe(404);
    });

    it("creates a post for an existing user, visible immediately in both listings", async () => {
      const createRes = await request(app)
        .post(`${config.apiPrefix}/users/2/posts`)
        .send({ title: "New Post", body: "Hello from a test." });
      expect(createRes.status).toBe(201);
      expect(createRes.body.userId).toBe(2);
      const id = createRes.body.id;

      const nested = await request(app).get(`${config.apiPrefix}/users/2/posts`);
      expect(nested.body.data.some((p: { id: string }) => p.id === id)).toBe(true);

      const topLevel = await request(app).get(`${BASE}/${id}`);
      expect(topLevel.status).toBe(200);
    });

    it("ignores a userId supplied in the POST body in favor of the URL's user id", async () => {
      const createRes = await request(app)
        .post(`${config.apiPrefix}/users/3/posts`)
        .send({ title: "T", body: "B", userId: 999 });
      expect(createRes.status).toBe(400);
    });

    it("rejects an invalid body on nested create", async () => {
      const missingTitle = await request(app).post(`${config.apiPrefix}/users/1/posts`).send({ body: "B" });
      expect(missingTitle.status).toBe(400);

      const unexpectedField = await request(app)
        .post(`${config.apiPrefix}/users/1/posts`)
        .send({ title: "T", body: "B", notAField: true });
      expect(unexpectedField.status).toBe(400);
    });

    it("returns 404 on POST for a nonexistent user", async () => {
      const res = await request(app)
        .post(`${config.apiPrefix}/users/999999/posts`)
        .send({ title: "T", body: "B" });
      expect(res.status).toBe(404);
    });
  });
});
