import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";

describe("Header echo (User Story 5)", () => {
  it("echoes ordinary custom headers exactly as sent", async () => {
    const res = await request(app).get("/headers").set("X-Custom-Header", "hello");
    expect(res.status).toBe(200);
    expect(res.body.headers["x-custom-header"]).toBe("hello");
  });

  it("never echoes Authorization, Cookie, or X-API-Key", async () => {
    const res = await request(app)
      .get("/headers")
      .set("X-Custom-Header", "hello")
      .set("Authorization", "Bearer should-not-appear")
      .set("Cookie", "session=should-not-appear")
      .set("X-API-Key", "should-not-appear");
    expect(res.status).toBe(200);
    expect(res.body.headers["x-custom-header"]).toBe("hello");
    expect(res.body.headers.authorization).toBeUndefined();
    expect(res.body.headers.cookie).toBeUndefined();
    expect(res.body.headers["x-api-key"]).toBeUndefined();
  });

  it("returns 200 with default client headers when no custom headers are sent", async () => {
    const res = await request(app).get("/headers");
    expect(res.status).toBe(200);
    expect(res.body.headers).toBeTypeOf("object");
    expect(Object.keys(res.body.headers).length).toBeGreaterThan(0);
  });
});
