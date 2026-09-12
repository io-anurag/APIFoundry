import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";

describe("Content types (User Story 4)", () => {
  it("GET /content/json returns 200 with application/json and a valid JSON body", async () => {
    const res = await request(app).get("/content/json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof res.body).toBe("object");
  });

  it("GET /content/text returns 200 with text/plain", async () => {
    const res = await request(app).get("/content/text");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/plain/);
  });

  it("GET /content/html returns 200 with text/html", async () => {
    const res = await request(app).get("/content/html");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/html/);
  });

  it("GET /content/xml returns 200 with application/xml", async () => {
    const res = await request(app).get("/content/xml");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/xml/);
  });

  it("rejects an undocumented content type with 400", async () => {
    const res = await request(app).get("/content/csv");
    expect(res.status).toBe(400);
  });

  it("accepts POST /content/json with a matching Content-Type", async () => {
    const res = await request(app).post("/content/json").set("Content-Type", "application/json").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accepted: true, type: "json" });
  });

  it("rejects POST /content/json with a mismatched Content-Type", async () => {
    const res = await request(app).post("/content/json").set("Content-Type", "text/plain").send("not json");
    expect(res.status).toBe(415);
  });
});
