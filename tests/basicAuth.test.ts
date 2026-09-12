import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetStores } from "./helpers/resetStores";
import { BASIC_AUTH_DEMO_ACCOUNT } from "../src/data/basicAuthAccount.seed";

describe("Basic Auth (User Story 4)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("authenticates with valid demo credentials", async () => {
    const res = await request(app)
      .get("/auth-test/basic")
      .auth(BASIC_AUTH_DEMO_ACCOUNT.username, BASIC_AUTH_DEMO_ACCOUNT.password);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: true, username: BASIC_AUTH_DEMO_ACCOUNT.username });
  });

  it("rejects the demo username with a wrong password", async () => {
    const res = await request(app).get("/auth-test/basic").auth(BASIC_AUTH_DEMO_ACCOUNT.username, "wrong");
    expect(res.status).toBe(401);
  });

  it("rejects an unknown username with the same shape as a wrong password", async () => {
    const wrongPassRes = await request(app).get("/auth-test/basic").auth(BASIC_AUTH_DEMO_ACCOUNT.username, "wrong");
    const unknownUserRes = await request(app).get("/auth-test/basic").auth("nobody", "whatever");
    expect(unknownUserRes.status).toBe(401);
    expect(unknownUserRes.body.error.code).toBe(wrongPassRes.body.error.code);
    expect(unknownUserRes.body.error.message).toBe(wrongPassRes.body.error.message);
  });

  it("rejects a missing Authorization header with 401", async () => {
    const res = await request(app).get("/auth-test/basic");
    expect(res.status).toBe(401);
  });

  it("rejects a non-Basic Authorization header with 401, distinguishable from wrong-credential", async () => {
    const malformedRes = await request(app).get("/auth-test/basic").set("Authorization", "Bearer not-basic-auth");
    const wrongPassRes = await request(app).get("/auth-test/basic").auth(BASIC_AUTH_DEMO_ACCOUNT.username, "wrong");
    expect(malformedRes.status).toBe(401);
    expect(malformedRes.body.error.message).not.toBe(wrongPassRes.body.error.message);
  });

  it("handles a password containing a colon by splitting on the first colon only", async () => {
    const res = await request(app).get("/auth-test/basic").auth(BASIC_AUTH_DEMO_ACCOUNT.username, "wrong:withcolon");
    expect(res.status).toBe(401);
  });
});
