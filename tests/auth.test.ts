import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetStores } from "./helpers/resetStores";
import { DEMO_ACCOUNTS } from "../src/data/demoAccounts.seed";

const admin = DEMO_ACCOUNTS.find((a) => a.role === "admin")!;

describe("Auth: login, identity, refresh, logout (User Story 1)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("logs in with a valid demo credential and returns a token pair", async () => {
    const res = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.tokenType).toBe("Bearer");
    expect(typeof res.body.expiresIn).toBe("number");
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app).post("/auth/login").send({ username: admin.username, password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an unknown username with the same 401 shape as a wrong password (never reveal existence)", async () => {
    const wrongPassRes = await request(app).post("/auth/login").send({ username: admin.username, password: "wrong" });
    const unknownUserRes = await request(app).post("/auth/login").send({ username: "nobody", password: "wrong" });
    expect(unknownUserRes.status).toBe(401);
    expect(unknownUserRes.body.error.code).toBe(wrongPassRes.body.error.code);
    expect(unknownUserRes.body.error.message).toBe(wrongPassRes.body.error.message);
  });

  it("rejects a malformed login body with 400", async () => {
    const res = await request(app).post("/auth/login").send({ username: admin.username });
    expect(res.status).toBe(400);
  });

  it("returns identity from GET /auth/me with a valid access token", async () => {
    const login = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });
    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.sub).toBe(admin.username);
    expect(res.body.role).toBe("admin");
    expect(res.body.scopes).toEqual(admin.scopes);
  });

  it("rejects GET /auth/me with no token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("rotates tokens on refresh and rejects the stale refresh token afterward", async () => {
    const login = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });
    const refreshRes = await request(app).post("/auth/refresh").send({ refreshToken: login.body.refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.accessToken).toBe("string");
    expect(typeof refreshRes.body.refreshToken).toBe("string");
    expect(refreshRes.body.refreshToken).not.toBe(login.body.refreshToken);

    const staleRes = await request(app).post("/auth/refresh").send({ refreshToken: login.body.refreshToken });
    expect(staleRes.status).toBe(401);
  });

  it("rejects a malformed refresh body with 400", async () => {
    const res = await request(app).post("/auth/refresh").send({});
    expect(res.status).toBe(400);
  });

  it("rejects presenting a refresh token where an access token is expected, and vice versa", async () => {
    const login = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });

    const meWithRefresh = await request(app).get("/auth/me").set("Authorization", `Bearer ${login.body.refreshToken}`);
    expect(meWithRefresh.status).toBe(401);

    const refreshWithAccess = await request(app).post("/auth/refresh").send({ refreshToken: login.body.accessToken });
    expect(refreshWithAccess.status).toBe(401);
  });

  it("logs out, subsequently rejects the same token, and stays idempotent on a second logout", async () => {
    const login = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });
    const token = login.body.accessToken;

    const logoutRes = await request(app).post("/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(meRes.status).toBe(401);

    const secondLogoutRes = await request(app).post("/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(secondLogoutRes.status).toBe(200);
  });

  it("rejects logout with a token that was never valid", async () => {
    const res = await request(app).post("/auth/logout").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("carries X-Request-ID on every response", async () => {
    const res = await request(app).post("/auth/login").send({ username: admin.username, password: admin.password });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});
