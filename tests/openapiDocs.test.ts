import { describe, it, expect } from "vitest";
import request from "supertest";
import yaml from "js-yaml";
import { app } from "../src/app";

describe("GET /openapi.json", () => {
  it("returns the OpenAPI document with no authentication required", async () => {
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);
  });
});

describe("GET /openapi.yaml", () => {
  it("returns the identical document as /openapi.json, serialized as YAML, no auth required", async () => {
    const jsonRes = await request(app).get("/openapi.json");
    const yamlRes = await request(app).get("/openapi.yaml");

    expect(yamlRes.status).toBe(200);
    expect(yamlRes.headers["content-type"]).toMatch(/yaml|text/);

    const parsed = yaml.load(yamlRes.text) as Record<string, unknown>;
    expect(Object.keys(parsed.paths as object).sort()).toEqual(
      Object.keys(jsonRes.body.paths).sort()
    );
  });
});

describe("GET /docs", () => {
  it("serves the interactive Swagger UI with no authentication required", async () => {
    const res = await request(app).get("/docs/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text.toLowerCase()).toContain("swagger-ui");
  });
});
