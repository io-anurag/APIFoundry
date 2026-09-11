import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { buildCorsMiddleware } from "../src/middleware/cors";
import { requestId } from "../src/middleware/requestId";
import { notFoundHandler, errorHandler } from "../src/middleware/errorHandler";

function buildTestApp(corsOriginValue: string) {
  const app = express();
  app.use(requestId);
  app.use(buildCorsMiddleware(corsOriginValue));
  app.get("/probe", (_req, res) => res.status(200).json({ ok: true }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("CORS enforcement", () => {
  it("rejects a request from an origin outside a configured, non-* allow-list", async () => {
    const app = buildTestApp("https://allowed.example");
    const res = await request(app).get("/probe").set("Origin", "https://not-allowed.example");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CORS_NOT_ALLOWED");
  });

  it("allows a request from an origin present in the configured allow-list", async () => {
    const app = buildTestApp("https://allowed.example");
    const res = await request(app).get("/probe").set("Origin", "https://allowed.example");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example");
  });

  it("allows any origin when configured as '*'", async () => {
    const app = buildTestApp("*");
    const res = await request(app).get("/probe").set("Origin", "https://anything.example");
    expect(res.status).toBe(200);
  });
});
