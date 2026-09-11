import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/comments`;

describe("Comments resource", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("Read-only catalog (User Story 1)", () => {
    it("seeds at least 200 deterministic comments (FR-002)", async () => {
      const res = await request(app).get(`${BASE}?limit=1`);
      expect(res.status).toBe(200);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(200);
    });

    it("gets a known seeded comment by id", async () => {
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

  describe("Nested route: posts/:id/comments (User Story 2)", () => {
    it("lists comments on an existing post", async () => {
      const posts = await request(app).get(`${config.apiPrefix}/posts?limit=1`);
      const postId = posts.body.data[0].id;

      const res = await request(app).get(`${config.apiPrefix}/posts/${postId}/comments`);
      expect(res.status).toBe(200);
      for (const comment of res.body.data) {
        expect(comment.postId).toBe(postId);
      }
    });

    it("returns 404 for a nonexistent post", async () => {
      const res = await request(app).get(
        `${config.apiPrefix}/posts/00000000-0000-4000-8000-000000000000/comments`
      );
      expect(res.status).toBe(404);
    });

    it("creates a comment for an existing post, visible immediately in both listings", async () => {
      const posts = await request(app).get(`${config.apiPrefix}/posts?limit=1`);
      const postId = posts.body.data[0].id;

      const createRes = await request(app)
        .post(`${config.apiPrefix}/posts/${postId}/comments`)
        .send({ userId: 1, body: "Nice post!" });
      expect(createRes.status).toBe(201);
      expect(createRes.body.postId).toBe(postId);
      const id = createRes.body.id;

      const nested = await request(app).get(`${config.apiPrefix}/posts/${postId}/comments`);
      expect(nested.body.data.some((c: { id: number }) => c.id === id)).toBe(true);

      const topLevel = await request(app).get(`${BASE}/${id}`);
      expect(topLevel.status).toBe(200);
    });

    it("rejects a missing or unresolvable userId on nested create", async () => {
      const posts = await request(app).get(`${config.apiPrefix}/posts?limit=1`);
      const postId = posts.body.data[0].id;

      const missing = await request(app)
        .post(`${config.apiPrefix}/posts/${postId}/comments`)
        .send({ body: "No author" });
      expect(missing.status).toBe(400);

      const unresolvable = await request(app)
        .post(`${config.apiPrefix}/posts/${postId}/comments`)
        .send({ userId: 999999, body: "Ghost author" });
      expect(unresolvable.status).toBe(400);
    });

    it("ignores a postId supplied in the body in favor of the URL's post id", async () => {
      const posts = await request(app).get(`${config.apiPrefix}/posts?limit=1`);
      const postId = posts.body.data[0].id;

      const res = await request(app)
        .post(`${config.apiPrefix}/posts/${postId}/comments`)
        .send({ userId: 1, body: "B", postId: "00000000-0000-4000-8000-000000000000" });
      expect(res.status).toBe(400);
    });

    it("returns 404 on POST for a nonexistent post", async () => {
      const res = await request(app)
        .post(`${config.apiPrefix}/posts/00000000-0000-4000-8000-000000000000/comments`)
        .send({ userId: 1, body: "B" });
      expect(res.status).toBe(404);
    });
  });
});
