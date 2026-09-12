import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { PAYLOAD_SIZE_PRESET_BYTES } from "../src/data/payloadPresets.catalog";

describe("Payload generation (User Story 2)", () => {
  it.each(Object.entries(PAYLOAD_SIZE_PRESET_BYTES))("GET /payload/%s returns exactly the preset's byte count", async (preset, expectedBytes) => {
    const res = await request(app).get(`/payload/${preset}`);
    expect(res.status).toBe(200);
    expect(Buffer.byteLength(res.text, "utf8")).toBe(expectedBytes);
    expect(res.body.size).toBe(expectedBytes);
  });

  it("GET /payload?size= returns exactly the requested byte count", async () => {
    const res = await request(app).get("/payload?size=2048");
    expect(res.status).toBe(200);
    expect(Buffer.byteLength(res.text, "utf8")).toBe(2048);
    expect(res.body.size).toBe(2048);
  });

  it("rejects a size over the configured maximum", async () => {
    const res = await request(app).get("/payload?size=999999999");
    expect(res.status).toBe(400);
  });

  it("rejects an undocumented preset", async () => {
    const res = await request(app).get("/payload/huge");
    expect(res.status).toBe(400);
  });

  it.each(["-1", "abc"])("rejects an invalid size '%s'", async (size) => {
    const res = await request(app).get(`/payload?size=${size}`);
    expect(res.status).toBe(400);
  });

  it("returns a minimal body (not an error) for size=0", async () => {
    const res = await request(app).get("/payload?size=0");
    expect(res.status).toBe(200);
    expect(res.body.size).toBe(0);
    expect(res.body.data).toBe("");
  });
});

describe("Payload echo (User Story 3)", () => {
  it("echoes the exact byte length of a small JSON object body", async () => {
    const body = { hello: "world" };
    const expectedBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
    const res = await request(app).post("/payload").send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, contentLength: expectedBytes });
  });

  it("echoes the exact byte length of a large in-bounds JSON body", async () => {
    const body = { data: "a".repeat(50_000) };
    const expectedBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
    const res = await request(app).post("/payload").send(body);
    expect(res.status).toBe(200);
    expect(res.body.contentLength).toBe(expectedBytes);
  });

  it("echoes the exact byte length of a deeply nested object body", async () => {
    const body = { nested: { a: [1, 2, 3] }, arr: [{ x: 1 }] };
    const expectedBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
    const res = await request(app).post("/payload").send(body);
    expect(res.status).toBe(200);
    expect(res.body.contentLength).toBe(expectedBytes);
  });

  it("echoes the exact byte length of a top-level array body", async () => {
    const body = [1, 2, 3, "four"];
    const expectedBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
    const res = await request(app).post("/payload").send(body);
    expect(res.status).toBe(200);
    expect(res.body.contentLength).toBe(expectedBytes);
  });

  it("rejects a body that is not valid JSON", async () => {
    const res = await request(app).post("/payload").set("Content-Type", "application/json").send("{not valid json");
    expect(res.status).toBe(400);
  });

  it("reports contentLength 0 for an empty body", async () => {
    const res = await request(app).post("/payload").set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, contentLength: 0 });
  });

  it("rejects a body larger than config.maxPayloadSize with 413", async () => {
    const oversized = "a".repeat(11 * 1024 * 1024);
    const res = await request(app).post("/payload").set("Content-Type", "application/json").send(JSON.stringify(oversized));
    expect(res.status).toBe(413);
  });
});
