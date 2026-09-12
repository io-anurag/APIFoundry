import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";

describe("Cookies (User Story 6)", () => {
  it("GET /cookies with none set returns an empty map", async () => {
    const res = await request(app).get("/cookies");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cookies: {} });
  });

  it("POST /cookies sets a cookie via Set-Cookie", async () => {
    const res = await request(app).post("/cookies").send({ name: "a", value: "1" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "a", value: "1" });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^a=1/);
  });

  it("reports multiple independently-set cookies when resent together", async () => {
    const res = await request(app).get("/cookies").set("Cookie", "a=1; b=2");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cookies: { a: "1", b: "2" } });
  });

  it("DELETE /cookies?name= clears just the named cookie, leaving others reported by the client intact", async () => {
    const delRes = await request(app).delete("/cookies?name=a");
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ cleared: true, name: "a" });
    expect(delRes.headers["set-cookie"]?.[0]).toMatch(/^a=;/);

    const getRes = await request(app).get("/cookies").set("Cookie", "b=2");
    expect(getRes.body).toEqual({ cookies: { b: "2" } });
  });

  it("DELETE /cookies?name= is idempotent for a name that was never set", async () => {
    const res = await request(app).delete("/cookies?name=never-set");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cleared: true, name: "never-set" });
  });

  it("rejects POST /cookies with a missing name", async () => {
    const res = await request(app).post("/cookies").send({ value: "1" });
    expect(res.status).toBe(400);
  });

  it("rejects DELETE /cookies with no ?name=", async () => {
    const res = await request(app).delete("/cookies");
    expect(res.status).toBe(400);
  });

  it("round-trips a cookie value containing a space and a semicolon", async () => {
    const setRes = await request(app).post("/cookies").send({ name: "c", value: "a value; with stuff" });
    expect(setRes.status).toBe(200);
    const setCookieHeader = setRes.headers["set-cookie"]?.[0] ?? "";
    const encodedValue = setCookieHeader.split(";")[0].split("=").slice(1).join("=");

    const getRes = await request(app).get("/cookies").set("Cookie", `c=${encodedValue}`);
    expect(getRes.body).toEqual({ cookies: { c: "a value; with stuff" } });
  });
});
