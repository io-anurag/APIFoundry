import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import packageJson from "../package.json";

describe("GET /version", () => {
  it("returns 200 with VersionInfo shape matching package.json and configured environment", async () => {
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(packageJson.version);
    expect(res.body.nodeEnv).toBe(config.nodeEnv);
  });
});
