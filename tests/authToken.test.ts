import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetStores } from "./helpers/resetStores";

describe("Auth: convenience token issuance & inspection (User Story 2)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("issues a valid token carrying exactly the requested role and scopes", async () => {
    const issueRes = await request(app)
      .post("/auth/token")
      .send({ role: "manager", scopes: ["products:read", "orders:write"], kind: "valid" });
    expect(issueRes.status).toBe(200);
    expect(issueRes.body.kind).toBe("valid");

    const infoRes = await request(app).get("/auth/token-info").set("Authorization", `Bearer ${issueRes.body.accessToken}`);
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.state).toBe("valid");
    expect(infoRes.body.claims.role).toBe("manager");
    expect(infoRes.body.claims.scopes).toEqual(["products:read", "orders:write"]);
  });

  it("issues an expired token whose token-info state is 'expired'", async () => {
    const issueRes = await request(app).post("/auth/token").send({ role: "user", scopes: [], kind: "expired" });
    const infoRes = await request(app).get("/auth/token-info").set("Authorization", `Bearer ${issueRes.body.accessToken}`);
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.state).toBe("expired");
  });

  it("issues an invalid-signature token whose token-info state is 'invalid-signature'", async () => {
    const issueRes = await request(app).post("/auth/token").send({ role: "user", scopes: [], kind: "invalid" });
    const infoRes = await request(app).get("/auth/token-info").set("Authorization", `Bearer ${issueRes.body.accessToken}`);
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.state).toBe("invalid-signature");
  });

  it("issues a revoked token whose token-info state is 'revoked'", async () => {
    const issueRes = await request(app).post("/auth/token").send({ role: "user", scopes: [], kind: "revoked" });
    const infoRes = await request(app).get("/auth/token-info").set("Authorization", `Bearer ${issueRes.body.accessToken}`);
    expect(infoRes.status).toBe(200);
    expect(infoRes.body.state).toBe("revoked");
  });

  it("rejects an unknown role, scope, or kind with 400/422", async () => {
    const badRole = await request(app).post("/auth/token").send({ role: "superadmin", scopes: [], kind: "valid" });
    expect([400, 422]).toContain(badRole.status);

    const badScope = await request(app).post("/auth/token").send({ role: "user", scopes: ["not:a-scope"], kind: "valid" });
    expect([400, 422]).toContain(badScope.status);

    const badKind = await request(app).post("/auth/token").send({ role: "user", scopes: [], kind: "bogus" });
    expect([400, 422]).toContain(badKind.status);
  });

  it("rejects a malformed or empty token on GET /auth/token-info with 400", async () => {
    const missing = await request(app).get("/auth/token-info");
    expect(missing.status).toBe(400);

    const malformed = await request(app).get("/auth/token-info").set("Authorization", "Bearer not-a-jwt");
    expect(malformed.status).toBe(400);
  });
});
