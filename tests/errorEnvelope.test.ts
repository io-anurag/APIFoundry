import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";

describe("shared error envelope", () => {
  it("returns 404 RESOURCE_NOT_FOUND for an undefined route", async () => {
    const res = await request(app).get("/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
    expect(typeof res.body.error.requestId).toBe("string");
    expect(res.body.error.requestId.length).toBeGreaterThan(0);
  });

  it("returns 405 METHOD_NOT_ALLOWED for an unsupported method on a defined route", async () => {
    const res = await request(app).post("/health");
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("returns 400 VALIDATION_ERROR for a malformed JSON body", async () => {
    const res = await request(app)
      .post(`${config.apiPrefix}/info`)
      .set("Content-Type", "application/json")
      .send("{not-json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps serving subsequent requests correctly after each error scenario", async () => {
    await request(app).get("/this-route-does-not-exist");
    await request(app).post("/health");
    await request(app).post(`${config.apiPrefix}/info`).set("Content-Type", "application/json").send("{not-json");

    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
