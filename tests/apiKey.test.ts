import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetStores } from "./helpers/resetStores";

describe("API Key: issue and use (User Story 1)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("issues a new, active key with no body", async () => {
    const res = await request(app).post("/auth/api-key").send();
    expect(res.status).toBe(201);
    expect(typeof res.body.apiKey).toBe("string");
    expect(typeof res.body.keyId).toBe("string");
    expect(res.body.label).toBeNull();
    expect(res.body.status).toBe("active");
    expect(typeof res.body.issuedAt).toBe("string");
    expect(res.body.expiresAt).toBeNull();
  });

  it("issues a key with a caller-supplied label", async () => {
    const res = await request(app).post("/auth/api-key").send({ label: "ci-suite" });
    expect(res.status).toBe(201);
    expect(res.body.label).toBe("ci-suite");
  });

  it("grants access to the protected endpoint with a freshly issued key", async () => {
    const issued = await request(app).post("/auth/api-key").send();
    const res = await request(app).get("/api-key/protected").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(200);
    expect(res.body.granted).toBe(true);
    expect(res.body.keyId).toBe(issued.body.keyId);
    expect(res.body.label).toBeNull();
  });

  it("rejects a missing X-API-Key header with 401", async () => {
    const res = await request(app).get("/api-key/protected");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an empty-string X-API-Key header with 401 (never a partial match)", async () => {
    const res = await request(app).get("/api-key/protected").set("X-API-Key", "");
    expect(res.status).toBe(401);
  });

  it("rejects a well-formed but never-issued key with 401", async () => {
    const res = await request(app).get("/api-key/protected").set("X-API-Key", "0".repeat(64));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("API Key: revoke (User Story 2)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("revokes a freshly issued, active key", async () => {
    const issued = await request(app).post("/auth/api-key").send();
    const res = await request(app).post("/auth/api-key/revoke").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(200);
  });

  it("rejects the same key on the protected endpoint after revocation", async () => {
    const issued = await request(app).post("/auth/api-key").send();
    await request(app).post("/auth/api-key/revoke").set("X-API-Key", issued.body.apiKey);
    const res = await request(app).get("/api-key/protected").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(401);
  });

  it("is idempotent when revoking the same key twice", async () => {
    const issued = await request(app).post("/auth/api-key").send();
    await request(app).post("/auth/api-key/revoke").set("X-API-Key", issued.body.apiKey);
    const res = await request(app).post("/auth/api-key/revoke").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(200);
  });

  it("rejects revoking a well-formed but never-issued key with 404", async () => {
    const res = await request(app).post("/auth/api-key/revoke").set("X-API-Key", "1".repeat(64));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("rejects revoking with no X-API-Key header at all with 401, not 404", async () => {
    const res = await request(app).post("/auth/api-key/revoke");
    expect(res.status).toBe(401);
  });
});

describe("API Key: purpose-built kind values (User Story 3)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("issues an already-expired key with kind: expired", async () => {
    const issued = await request(app).post("/auth/api-key").send({ kind: "expired" });
    expect(issued.status).toBe(201);
    expect(issued.body.status).toBe("expired");
    expect(Date.parse(issued.body.expiresAt)).toBeLessThan(Date.now());

    const res = await request(app).get("/api-key/protected").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(401);
  });

  it("issues an already-revoked key with kind: revoked", async () => {
    const issued = await request(app).post("/auth/api-key").send({ kind: "revoked" });
    expect(issued.status).toBe(201);
    expect(issued.body.status).toBe("revoked");

    const res = await request(app).get("/api-key/protected").set("X-API-Key", issued.body.apiKey);
    expect(res.status).toBe(401);
  });

  it("rejects an unknown kind value with 400", async () => {
    const res = await request(app).post("/auth/api-key").send({ kind: "bogus" });
    expect(res.status).toBe(400);
  });
});
