import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";

describe("X-Request-ID correlation", () => {
  it("attaches a non-empty X-Request-ID header to success responses", async () => {
    for (const path of ["/health", "/version", `${config.apiPrefix}/info`]) {
      const res = await request(app).get(path);
      expect(res.headers["x-request-id"]).toBeTruthy();
    }
  });

  it("attaches X-Request-ID to error responses and matches error.requestId", async () => {
    const notFound = await request(app).get("/this-route-does-not-exist");
    expect(notFound.headers["x-request-id"]).toBeTruthy();
    expect(notFound.body.error.requestId).toBe(notFound.headers["x-request-id"]);

    const badBody = await request(app)
      .post(`${config.apiPrefix}/info`)
      .set("Content-Type", "application/json")
      .send("{not-json");
    expect(badBody.headers["x-request-id"]).toBeTruthy();
    expect(badBody.body.error.requestId).toBe(badBody.headers["x-request-id"]);
  });
});
