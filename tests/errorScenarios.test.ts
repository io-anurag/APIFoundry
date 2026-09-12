import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetStores } from "./helpers/resetStores";

describe("Dedicated /errors/* endpoints (User Story 1)", () => {
  beforeEach(() => {
    resetStores();
  });

  const cases: Array<{ path: string; status: number; code: string }> = [
    { path: "validation", status: 400, code: "VALIDATION_ERROR" },
    { path: "not-found", status: 404, code: "RESOURCE_NOT_FOUND" },
    { path: "conflict", status: 409, code: "CONFLICT" },
    { path: "unauthorized", status: 401, code: "UNAUTHORIZED" },
    { path: "forbidden", status: 403, code: "FORBIDDEN" },
    { path: "rate-limit", status: 429, code: "RATE_LIMIT_EXCEEDED" },
    { path: "server-error", status: 500, code: "INTERNAL_ERROR" },
    { path: "service-unavailable", status: 503, code: "SERVICE_UNAVAILABLE" },
    { path: "timeout", status: 408, code: "REQUEST_TIMEOUT" },
  ];

  for (const { path, status, code } of cases) {
    it(`GET /errors/${path} always returns ${status} ${code}`, async () => {
      const res1 = await request(app).get(`/errors/${path}`);
      expect(res1.status).toBe(status);
      expect(res1.body.error.code).toBe(code);
      expect(res1.headers["x-request-id"]).toBeDefined();

      const res2 = await request(app).get(`/errors/${path}`);
      expect(res2.status).toBe(status);
      expect(res2.body.error.code).toBe(code);
    });
  }

  it("GET /errors/rate-limit includes a Retry-After header", async () => {
    const res = await request(app).get("/errors/rate-limit");
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("GET /errors/unauthorized ignores a supplied Authorization header", async () => {
    const res = await request(app).get("/errors/unauthorized").set("Authorization", "Bearer not-even-parsed");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /errors/forbidden ignores a supplied Authorization header", async () => {
    const res = await request(app).get("/errors/forbidden").set("Authorization", "Bearer not-even-parsed");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("POST /errors/not-found is rejected with 405 Method Not Allowed", async () => {
    const res = await request(app).post("/errors/not-found");
    expect(res.status).toBe(405);
  });
});
