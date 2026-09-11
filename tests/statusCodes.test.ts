import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { STATUS_CODE_DEMOS } from "../src/data/statusCodeDemos.catalog";

const BASE = `${config.apiPrefix}/status`;

const EXPECTED_ERROR_CODES: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "RESOURCE_NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  406: "NOT_ACCEPTABLE",
  408: "REQUEST_TIMEOUT",
  409: "CONFLICT",
  410: "GONE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMIT_EXCEEDED",
  500: "INTERNAL_ERROR",
  501: "NOT_IMPLEMENTED",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

describe("Status Code Playground (User Story 1)", () => {
  it.each(STATUS_CODE_DEMOS)("code=$code ($name) returns that exact status", async ({ code }) => {
    const res = await request(app).get(`${BASE}/${code}`);
    expect(res.status).toBe(code);
  });

  it.each([200, 201, 202])("code=%i returns a JSON body with status/name/message", async (code) => {
    const res = await request(app).get(`${BASE}/${code}`);
    expect(res.body.status).toBe(code);
    expect(typeof res.body.name).toBe("string");
    expect(typeof res.body.message).toBe("string");
  });

  it.each([204, 304])("code=%i returns no response body", async (code) => {
    const res = await request(app).get(`${BASE}/${code}`);
    expect(res.status).toBe(code);
    expect(res.text).toBe("");
  });

  it.each([301, 302])("code=%i sets Location and returns a JSON body with location", async (code) => {
    const res = await request(app).get(`${BASE}/${code}`);
    const target = `${config.apiPrefix}/status/200`;
    expect(res.headers.location).toBe(target);
    expect(res.body.location).toBe(target);
  });

  it.each(Object.entries(EXPECTED_ERROR_CODES))("code=%s returns error.code=%s", async (codeStr, errorCode) => {
    const code = Number(codeStr);
    const res = await request(app).get(`${BASE}/${code}`);
    expect(res.status).toBe(code);
    expect(res.body.error.code).toBe(errorCode);
  });

  it("405 includes an Allow header", async () => {
    const res = await request(app).get(`${BASE}/405`);
    expect(res.headers.allow).toBe("GET");
  });

  it("429 includes a Retry-After header", async () => {
    const res = await request(app).get(`${BASE}/429`);
    expect(res.headers["retry-after"]).toBeTruthy();
  });

  it("carries X-Request-ID on success, no-body, and error responses", async () => {
    const success = await request(app).get(`${BASE}/200`);
    expect(success.headers["x-request-id"]).toBeTruthy();

    const noBody = await request(app).get(`${BASE}/204`);
    expect(noBody.headers["x-request-id"]).toBeTruthy();

    const error = await request(app).get(`${BASE}/404`);
    expect(error.headers["x-request-id"]).toBeTruthy();
    expect(error.body.error.requestId).toBe(error.headers["x-request-id"]);
  });

  it("is fully deterministic across repeated requests, aside from the request id", async () => {
    const first = await request(app).get(`${BASE}/500`);
    const second = await request(app).get(`${BASE}/500`);
    expect(first.body.error.code).toBe(second.body.error.code);
    expect(first.body.error.message).toBe(second.body.error.message);
    expect(first.status).toBe(second.status);
  });
});

describe("Malformed code values (User Story 2)", () => {
  const malformed = ["abc", "-1", "0", "200.5", "0200", "99", "600", "9999999999"];

  it.each(malformed)("code=%s returns 400 VALIDATION_ERROR", async (value) => {
    const res = await request(app).get(`${BASE}/${value}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("a whitespace-padded value is rejected as malformed, never normalized", async () => {
    const res = await request(app).get(`${BASE}/${encodeURIComponent(" 200 ")}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("an empty code segment never reaches the validator and never crashes (falls through to 404)", async () => {
    const res = await request(app).get(`${BASE}/`);
    expect(res.status).toBe(404);
  });
});

describe("Well-formed but unsupported codes (User Story 3)", () => {
  it.each([418, 494])("code=%i returns 400 UNSUPPORTED_STATUS_CODE", async (code) => {
    const res = await request(app).get(`${BASE}/${code}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNSUPPORTED_STATUS_CODE");
  });
});
