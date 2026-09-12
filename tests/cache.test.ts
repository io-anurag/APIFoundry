import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { resetStores } from "./helpers/resetStores";

describe("Cached responses (User Story 4)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("returns 200 with ETag/Last-Modified/Cache-Control when no conditional headers are sent", async () => {
    const res = await request(app).get("/cache/resource");
    expect(res.status).toBe(200);
    expect(res.headers.etag).toBeDefined();
    expect(res.headers["last-modified"]).toBeDefined();
    expect(res.headers["cache-control"]).toBeDefined();
    expect(res.body.content).toEqual({ message: "Hello, cache!" });
  });

  it("returns 304 when If-None-Match matches the current ETag", async () => {
    const first = await request(app).get("/cache/resource");
    const res = await request(app).get("/cache/resource").set("If-None-Match", first.headers.etag);
    expect(res.status).toBe(304);
    expect(res.body).toEqual({});
  });

  it("returns 304 when If-Modified-Since is at or after Last-Modified (no If-None-Match)", async () => {
    const first = await request(app).get("/cache/resource");
    const res = await request(app)
      .get("/cache/resource")
      .set("If-Modified-Since", first.headers["last-modified"]);
    expect(res.status).toBe(304);
  });

  it("returns 200 when If-None-Match does not match", async () => {
    const res = await request(app).get("/cache/resource").set("If-None-Match", '"v999"');
    expect(res.status).toBe(200);
    expect(res.body.content).toBeDefined();
  });

  it("PUT updates content, increments version, and reissues validators", async () => {
    const before = await request(app).get("/cache/resource");
    const res = await request(app).put("/cache/resource").send({ content: { changed: true } });

    expect(res.status).toBe(200);
    expect(res.body.content).toEqual({ changed: true });
    expect(res.body.version).toBe(before.body.version + 1);
    expect(res.headers.etag).not.toBe(before.headers.etag);
  });

  it("a stale ETag no longer matches after a PUT", async () => {
    const before = await request(app).get("/cache/resource");
    await request(app).put("/cache/resource").send({ content: { changed: true } });

    const res = await request(app).get("/cache/resource").set("If-None-Match", before.headers.etag);
    expect(res.status).toBe(200);
  });

  it("If-None-Match wins over a conflicting If-Modified-Since", async () => {
    const first = await request(app).get("/cache/resource");
    const res = await request(app)
      .get("/cache/resource")
      .set("If-None-Match", '"v999"') // non-matching
      .set("If-Modified-Since", first.headers["last-modified"]); // matching
    expect(res.status).toBe(200);
  });

  it("treats a malformed If-Modified-Since as non-matching (never errors)", async () => {
    const res = await request(app).get("/cache/resource").set("If-Modified-Since", "not-a-date");
    expect(res.status).toBe(200);
  });

  it("rejects PUT with a missing content field", async () => {
    const res = await request(app).put("/cache/resource").send({});
    expect(res.status).toBe(400);
  });

  it("rejects unsupported methods", async () => {
    const res = await request(app).delete("/cache/resource");
    expect(res.status).toBe(405);
  });
});
