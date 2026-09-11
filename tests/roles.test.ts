import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { USER_ROLES } from "../src/models/enums";
import { resetStores } from "./helpers/resetStores";

const ROLE_BASE = `${config.apiPrefix}/role`;

async function issueToken(role: string): Promise<string> {
  const res = await request(app).post("/auth/token").send({ role, scopes: [], kind: "valid" });
  return res.body.accessToken;
}

describe("GET /api/v1/role/{role}: full role matrix (User Story 3)", () => {
  beforeEach(() => {
    resetStores();
  });

  for (const tokenRole of USER_ROLES) {
    for (const pathRole of USER_ROLES) {
      it(`a '${tokenRole}' token against /role/${pathRole} returns ${tokenRole === pathRole ? 200 : 403}`, async () => {
        const token = await issueToken(tokenRole);
        const res = await request(app).get(`${ROLE_BASE}/${pathRole}`).set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(tokenRole === pathRole ? 200 : 403);
      });
    }
  }

  it("returns 400 for a role path value that is not one of the four documented roles", async () => {
    const token = await issueToken("admin");
    const res = await request(app).get(`${ROLE_BASE}/superadmin`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid role even without a token", async () => {
    const res = await request(app).get(`${ROLE_BASE}/superadmin`);
    expect(res.status).toBe(400);
  });
});
