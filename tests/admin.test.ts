import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { resetStores } from "./helpers/resetStores";
import { rateLimitStore } from "../src/data/rateLimit.store";
import { DEMO_ACCOUNTS } from "../src/data/demoAccounts.seed";
import { issueScopedToken, bearer } from "./helpers/authToken";

const admin = DEMO_ACCOUNTS.find((a) => a.role === "admin")!;
const ADMIN_TOKEN_HEADER = "X-Admin-Token";
const VALID_TOKEN = config.adminToken;

describe("Admin: data reset (User Story 1)", () => {
  let token: string;

  beforeEach(async () => {
    resetStores();
    token = await issueScopedToken(["admin"]);
  });

  it("resets data to seed state and responds with the standard acknowledgment shape", async () => {
    const res = await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Data reset to seed state",
      domain: "data",
      requestId: res.headers["x-request-id"],
    });
  });

  it("restores a deleted product to its original seeded content", async () => {
    const before = await request(app).get(`${config.apiPrefix}/products/1`).set(...bearer(token));
    await request(app).delete(`${config.apiPrefix}/products/1`).set(...bearer(token));
    const afterDelete = await request(app).get(`${config.apiPrefix}/products/1`).set(...bearer(token));
    expect(afterDelete.status).toBe(404);

    await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);

    const afterReset = await request(app).get(`${config.apiPrefix}/products/1`).set(...bearer(token));
    expect(afterReset.status).toBe(200);
    // createdAt/updatedAt are stamped fresh on every seedProducts() call (products.seed.ts), so
    // only the deterministic content fields are compared here — not this feature's concern.
    const { createdAt: _c1, updatedAt: _u1, ...beforeContent } = before.body;
    const { createdAt: _c2, updatedAt: _u2, ...afterContent } = afterReset.body;
    expect(afterContent).toEqual(beforeContent);
  });

  it("clears the rate-limiter's counters", async () => {
    rateLimitStore.create({ id: "some-caller", count: 5, windowStart: Date.now() });
    expect(rateLimitStore.list()).toHaveLength(1);

    await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);

    expect(rateLimitStore.list()).toHaveLength(0);
  });

  it("clears the idempotency-key store so a previously used key is accepted as new", async () => {
    const key = randomUUID();
    const body = { orderId: 1, amount: 42.5, status: "pending" };

    const first = await request(app).post(`${config.apiPrefix}/payments`).set("Idempotency-Key", key).send(body);
    expect(first.status).toBe(201);

    const replay = await request(app).post(`${config.apiPrefix}/payments`).set("Idempotency-Key", key).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);

    await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);

    const afterReset = await request(app).post(`${config.apiPrefix}/payments`).set("Idempotency-Key", key).send(body);
    expect(afterReset.status).toBe(201);
    expect(afterReset.body.id).not.toBe(first.body.id);
  });

  it("is safe to call repeatedly with no mutation in between", async () => {
    const first = await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    const second = await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("never resets auth-domain state (an API key issued beforehand still works afterward)", async () => {
    const issued = await request(app).post("/auth/api-key").send();
    await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    const res = await request(app).get("/api-key/protected").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(200);
  });

  it("ignores any request body", async () => {
    const res = await request(app)
      .post("/admin/reset")
      .set(ADMIN_TOKEN_HEADER, VALID_TOKEN)
      .send({ foo: "bar" });
    expect(res.status).toBe(200);
  });

  it("rejects GET with 405", async () => {
    const res = await request(app).get("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    expect(res.status).toBe(405);
  });
});

describe("Admin: auth reset (User Story 2)", () => {
  let token: string;

  beforeEach(async () => {
    resetStores();
    token = await issueScopedToken(["admin"]);
  });

  it("resets auth state and responds with the standard acknowledgment shape", async () => {
    const res = await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Auth state reset to initial configuration",
      domain: "auth",
      requestId: res.headers["x-request-id"],
    });
  });

  it("invalidates a previously issued JWT session", async () => {
    const login = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });
    const before = await request(app).get("/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(before.status).toBe(200);

    await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);

    const after = await request(app).get("/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(after.status).toBe(401);
  });

  it("invalidates a previously issued API key", async () => {
    const issued = await request(app).post("/auth/api-key").send();
    await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    const res = await request(app).get("/api-key/protected").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(401);
  });

  it("still allows the documented demo account to log in immediately afterward", async () => {
    await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    const res = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("never resets data-domain state (a deletion made beforehand survives)", async () => {
    await request(app).delete(`${config.apiPrefix}/products/2`).set(...bearer(token));
    await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    // The auth reset just now revoked `token`'s session — issue a fresh one to check the data domain.
    token = await issueScopedToken(["admin"]);
    const res = await request(app).get(`${config.apiPrefix}/products/2`).set(...bearer(token));
    expect(res.status).toBe(404);
  });

  it("is safe to call when nothing has been issued since the last reset", async () => {
    const res = await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    expect(res.status).toBe(200);
  });

  it("rejects GET with 405", async () => {
    const res = await request(app).get("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    expect(res.status).toBe(405);
  });
});

describe("Admin: reject unauthorized callers (User Story 3)", () => {
  let token: string;

  beforeEach(async () => {
    resetStores();
    token = await issueScopedToken(["admin"]);
  });

  const paths = ["/admin/reset", "/admin/auth/reset"];

  for (const path of paths) {
    it(`${path}: rejects a missing X-Admin-Token header with 401`, async () => {
      const res = await request(app).post(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it(`${path}: rejects an empty-string X-Admin-Token header with 401 (never a partial match)`, async () => {
      const res = await request(app).post(path).set(ADMIN_TOKEN_HEADER, "");
      expect(res.status).toBe(401);
    });

    it(`${path}: rejects an incorrect X-Admin-Token header with 403`, async () => {
      const res = await request(app).post(path).set(ADMIN_TOKEN_HEADER, "not-the-real-token");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it(`${path}: a rejected call has no side effect`, async () => {
      await request(app).delete(`${config.apiPrefix}/products/3`).set(...bearer(token));
      await request(app).post(path).set(ADMIN_TOKEN_HEADER, "wrong");
      const res = await request(app).get(`${config.apiPrefix}/products/3`).set(...bearer(token));
      expect(res.status).toBe(404);
    });
  }

  it("calling both endpoints back to back (in either order) leaves the server equivalent to a fresh start across both domains", async () => {
    await request(app).delete(`${config.apiPrefix}/products/4`).set(...bearer(token));
    const issued = await request(app).post("/auth/api-key").send();

    await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);

    // The auth reset just now revoked `token`'s session — issue a fresh one to keep probing.
    token = await issueScopedToken(["admin"]);
    const product = await request(app).get(`${config.apiPrefix}/products/4`).set(...bearer(token));
    expect(product.status).toBe(200);
    const keyCheck = await request(app).get("/api-key/protected").set("X-API-Key", issued.body.apiKey);
    expect(keyCheck.status).toBe(401);

    await request(app).delete(`${config.apiPrefix}/products/4`).set(...bearer(token));
    const issuedAgain = await request(app).post("/auth/api-key").send();

    await request(app).post("/admin/auth/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);
    await request(app).post("/admin/reset").set(ADMIN_TOKEN_HEADER, VALID_TOKEN);

    // Same again — the second auth reset revoked this `token` too.
    token = await issueScopedToken(["admin"]);
    const productAgain = await request(app).get(`${config.apiPrefix}/products/4`).set(...bearer(token));
    expect(productAgain.status).toBe(200);
    const keyCheckAgain = await request(app).get("/api-key/protected").set("X-API-Key", issuedAgain.body.apiKey);
    expect(keyCheckAgain.status).toBe(401);
  });
});
