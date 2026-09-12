import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";

describe("Delay (User Story 1)", () => {
  it("waits at least the requested delay before responding, via the path form", async () => {
    const start = Date.now();
    const res = await request(app).get("/delay/50");
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ delayMs: 50 });
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it("waits at least the requested delay before responding, via the query form", async () => {
    const start = Date.now();
    const res = await request(app).get("/delay?ms=50");
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ delayMs: 50 });
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it("resolves immediately for a zero delay", async () => {
    const res = await request(app).get("/delay/0");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ delayMs: 0 });
  });

  it("rejects a delay over the configured maximum near-instantly", async () => {
    const start = Date.now();
    const res = await request(app).get(`/delay/${config.maxDelayMs + 1}`);
    const elapsed = Date.now() - start;
    expect(res.status).toBe(400);
    expect(elapsed).toBeLessThan(200);
  });

  it.each(["abc", "-5", "100.5", "", " 100 "])("rejects a malformed ms value '%s' with 400", async (value) => {
    const res = await request(app).get(`/delay?ms=${encodeURIComponent(value)}`);
    expect(res.status).toBe(400);
  });
});
