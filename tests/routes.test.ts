import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import type { RouteInfo } from "../src/models/routeInfo";

describe(`GET ${config.apiPrefix}/routes`, () => {
  it("returns every implemented route with no authentication required", async () => {
    const res = await request(app).get(`${config.apiPrefix}/routes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(99);
  });

  it("reports accurate auth requirements for representative routes", async () => {
    const res = await request(app).get(`${config.apiPrefix}/routes`);
    const routes: RouteInfo[] = res.body.data;

    const adminReset = routes.find((r) => r.method === "POST" && r.path === "/admin/reset");
    expect(adminReset?.auth).toEqual({ type: "adminToken" });

    const roleDemo = routes.find((r) => r.method === "GET" && r.path === "/api/v1/role/{role}");
    expect(roleDemo?.auth.type).toBe("jwt");
    expect(typeof roleDemo?.auth.detail).toBe("string");
    expect(roleDemo?.auth.detail?.length).toBeGreaterThan(0);

    const health = routes.find((r) => r.method === "GET" && r.path === "/health");
    expect(health?.auth).toEqual({ type: "none" });
  });

  it("returns 405 for unsupported methods", async () => {
    const res = await request(app).post(`${config.apiPrefix}/routes`);
    expect(res.status).toBe(405);
  });
});
