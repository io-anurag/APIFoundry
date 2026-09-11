import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { SCOPES } from "../src/models/enums";
import { resetStores } from "./helpers/resetStores";

const SCOPE_BASE = `${config.apiPrefix}/scope`;

async function issueToken(scopes: string[]): Promise<string> {
  const res = await request(app).post("/auth/token").send({ role: "user", scopes, kind: "valid" });
  return res.body.accessToken;
}

describe("GET /api/v1/scope/{scope}: scope enforcement (User Story 4)", () => {
  beforeEach(() => {
    resetStores();
  });

  for (const scope of SCOPES) {
    it(`a token carrying exactly '${scope}' is granted access to /scope/${scope}`, async () => {
      const token = await issueToken([scope]);
      const res = await request(app).get(`${SCOPE_BASE}/${scope}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ scope, granted: true });
    });
  }

  it("returns 403 with INSUFFICIENT_SCOPE when the required scope is missing", async () => {
    const token = await issueToken(["products:read"]);
    const res = await request(app).get(`${SCOPE_BASE}/orders:write`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INSUFFICIENT_SCOPE");
  });

  it("the admin scope satisfies every scope check regardless of the path's specific scope", async () => {
    const token = await issueToken(["admin"]);
    for (const scope of SCOPES) {
      const res = await request(app).get(`${SCOPE_BASE}/${scope}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it("a token carrying multiple scopes is granted access via any one of them", async () => {
    const token = await issueToken(["products:read", "orders:write"]);
    const res1 = await request(app).get(`${SCOPE_BASE}/products:read`).set("Authorization", `Bearer ${token}`);
    const res2 = await request(app).get(`${SCOPE_BASE}/orders:write`).set("Authorization", `Bearer ${token}`);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("returns 400 for a scope path value that is not one of the seven documented scopes", async () => {
    const token = await issueToken(["admin"]);
    const res = await request(app).get(`${SCOPE_BASE}/not-a-real-scope`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
