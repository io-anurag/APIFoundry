import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";

describe(`GET ${config.apiPrefix}/info`, () => {
  it("returns 200 with ApiInfo shape and no secret configuration values", async () => {
    const res = await request(app).get(`${config.apiPrefix}/info`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: expect.any(String),
      version: expect.any(String),
      environment: config.nodeEnv,
      apiPrefix: config.apiPrefix,
    });
    expect(typeof res.body.uptimeSeconds).toBe("number");

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(config.jwtSecret);
    expect(serialized).not.toContain(config.adminToken);
    expect(res.body).not.toHaveProperty("jwtSecret");
    expect(res.body).not.toHaveProperty("adminToken");
  });
});
