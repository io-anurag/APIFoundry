import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const BASE = `${config.apiPrefix}/search`;

describe("Search (User Story 4)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("returns matches across resources, each tagged with its resourceType", async () => {
    const res = await request(app).get(`${BASE}?q=electronics`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const hit of res.body.data) {
      expect(["user", "customer", "product", "category", "post", "comment", "review"]).toContain(
        hit.resourceType
      );
    }
  });

  it("returns 400 when q is missing", async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when q is an empty string", async () => {
    const res = await request(app).get(`${BASE}?q=`);
    expect(res.status).toBe(400);
  });

  it("returns 200 with empty data when q matches nothing", async () => {
    const res = await request(app).get(`${BASE}?q=zzzznomatchxyz`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("handles special characters and a long query without crashing", async () => {
    const special = await request(app).get(`${BASE}?q=${encodeURIComponent("%$#@!")}`);
    expect(special.status).toBe(200);

    const longQuery = "a".repeat(500);
    const long = await request(app).get(`${BASE}?q=${longQuery}`);
    expect(long.status).toBe(200);
  });

  it("matches case-insensitively", async () => {
    const lower = await request(app).get(`${BASE}?q=electronics`);
    const upper = await request(app).get(`${BASE}?q=ELECTRONICS`);
    expect(upper.body.data.length).toBe(lower.body.data.length);
  });

  it("carries X-Request-ID on success and error responses", async () => {
    const okRes = await request(app).get(`${BASE}?q=electronics`);
    expect(okRes.headers["x-request-id"]).toBeTruthy();

    const errRes = await request(app).get(BASE);
    expect(errRes.headers["x-request-id"]).toBeTruthy();
    expect(errRes.body.error.requestId).toBe(errRes.headers["x-request-id"]);
  });
});
