import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";

const PROTECTED = `${config.apiPrefix}/protected`;

async function issueToken(role: string, kind: string): Promise<string> {
  const res = await request(app).post("/auth/token").send({ role, scopes: [], kind });
  return res.body.accessToken;
}

describe("GET /api/v1/protected: 401 vs 403 vs 200 (User Story 3)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("returns 401 with no Authorization header", async () => {
    const res = await request(app).get(PROTECTED);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for an expired token", async () => {
    const token = await issueToken("admin", "expired");
    const res = await request(app).get(PROTECTED).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid-signature token", async () => {
    const token = await issueToken("admin", "invalid");
    const res = await request(app).get(PROTECTED).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a revoked token", async () => {
    const token = await issueToken("admin", "revoked");
    const res = await request(app).get(PROTECTED).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a valid token whose role is not admin", async () => {
    const token = await issueToken("readonly", "valid");
    const res = await request(app).get(PROTECTED).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 200 with granted:true for a valid admin-role token", async () => {
    const token = await issueToken("admin", "valid");
    const res = await request(app).get(PROTECTED).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ granted: true, role: "admin" });
  });
});
