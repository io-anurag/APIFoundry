import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { PAYLOAD_SIZE_PRESET_BYTES } from "../src/data/payloadPresets.catalog";
import { DOCUMENTED_STATUS_CODES } from "../src/models/statusCodeDemo";
import { resetStores } from "./helpers/resetStores";

describe("Generic scenario endpoint (User Story 2)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("GET /api/v1/test with no scenario defaults to success (200) and carries X-Request-ID", async () => {
    const res = await request(app).get("/api/v1/test");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("GET /api/v1/test?scenario=success returns 200", async () => {
    const res = await request(app).get("/api/v1/test?scenario=success");
    expect(res.status).toBe(200);
  });

  const fixedCases: Array<{ scenario: string; status: number; code: string }> = [
    { scenario: "validation-error", status: 400, code: "VALIDATION_ERROR" },
    { scenario: "unauthorized", status: 401, code: "UNAUTHORIZED" },
    { scenario: "forbidden", status: 403, code: "FORBIDDEN" },
    { scenario: "not-found", status: 404, code: "RESOURCE_NOT_FOUND" },
    { scenario: "conflict", status: 409, code: "CONFLICT" },
    { scenario: "rate-limit", status: 429, code: "RATE_LIMIT_EXCEEDED" },
    { scenario: "server-error", status: 500, code: "INTERNAL_ERROR" },
    { scenario: "service-unavailable", status: 503, code: "SERVICE_UNAVAILABLE" },
    { scenario: "timeout", status: 408, code: "REQUEST_TIMEOUT" },
  ];

  for (const { scenario, status, code } of fixedCases) {
    it(`GET /api/v1/test?scenario=${scenario} matches its /errors/* counterpart`, async () => {
      const scenarioRes = await request(app).get(`/api/v1/test?scenario=${scenario}`);
      expect(scenarioRes.status).toBe(status);
      expect(scenarioRes.body.error.code).toBe(code);
      expect(scenarioRes.headers["x-request-id"]).toBeDefined();

      const errorPath = scenario === "validation-error" ? "validation" : scenario;
      const errorRes = await request(app).get(`/errors/${errorPath}`);
      expect(errorRes.status).toBe(scenarioRes.status);
      expect(errorRes.body.error.code).toBe(scenarioRes.body.error.code);
    });
  }

  it("GET /api/v1/test?scenario=bogus returns 400 listing supported scenario names", async () => {
    const res = await request(app).get("/api/v1/test?scenario=bogus");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.supportedScenarios).toContain("success");
  });

  it("GET /api/v1/test?status=204 returns 204 with no body", async () => {
    const res = await request(app).get("/api/v1/test?status=204");
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("GET /api/v1/test?status=301 returns 301 with a Location header", async () => {
    const res = await request(app).get("/api/v1/test?status=301");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBeDefined();
  });

  it("GET /api/v1/test?scenario=not-found&status=404 is accepted (redundant)", async () => {
    const res = await request(app).get("/api/v1/test?scenario=not-found&status=404");
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/test?scenario=not-found&status=400 is rejected (conflict)", async () => {
    const res = await request(app).get("/api/v1/test?scenario=not-found&status=400");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("status escape hatch reaches every documented status code (SC-003)", () => {
  beforeEach(() => {
    resetStores();
  });

  const omitRequestId = (body: unknown): unknown => {
    if (body && typeof body === "object" && "error" in body) {
      const { error, ...rest } = body as { error: Record<string, unknown> };
      const { requestId, ...errorRest } = error;
      return { ...rest, error: errorRest };
    }
    return body;
  };

  for (const code of DOCUMENTED_STATUS_CODES) {
    it(`GET /api/v1/test?status=${code} matches GET /api/v1/status/${code} exactly`, async () => {
      const testRes = await request(app).get(`/api/v1/test?status=${code}`);
      const statusRes = await request(app).get(`/api/v1/status/${code}`);

      expect(testRes.status).toBe(code);
      expect(testRes.status).toBe(statusRes.status);
      expect(omitRequestId(testRes.body)).toEqual(omitRequestId(statusRes.body));
      expect(testRes.headers.location).toBe(statusRes.headers.location);
    });
  }
});

describe("Delay, large-response, and failureRate composability (User Story 3)", () => {
  beforeEach(() => {
    resetStores();
  });

  it("GET /api/v1/test?scenario=delayed&delay= waits at least the requested duration", async () => {
    const start = Date.now();
    const res = await request(app).get("/api/v1/test?scenario=delayed&delay=200");
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scenario: "delayed", status: 200, delayMs: 200 });
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });

  it("GET /api/v1/test?scenario=delayed&delay=<over max> is rejected without waiting", async () => {
    const res = await request(app).get(`/api/v1/test?scenario=delayed&delay=${config.maxDelayMs + 1}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/v1/test?scenario=large-response returns the Spec 007 'large' preset size", async () => {
    const res = await request(app).get("/api/v1/test?scenario=large-response");
    expect(res.status).toBe(200);
    expect(res.body.size).toBe(PAYLOAD_SIZE_PRESET_BYTES.large);
    expect(Buffer.byteLength(JSON.stringify(res.body), "utf8")).toBe(PAYLOAD_SIZE_PRESET_BYTES.large);
  });

  it("failureRate=0 always succeeds; failureRate=1 always fails; omitted matches /errors/*", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/api/v1/test?scenario=server-error&failureRate=0");
      expect(res.status).toBe(200);
    }
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/api/v1/test?scenario=server-error&failureRate=1");
      expect(res.status).toBe(500);
    }
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/api/v1/test?scenario=server-error");
      expect(res.status).toBe(500);
    }
  });

  it("rejects an invalid failureRate for a failure-representing scenario", async () => {
    for (const bad of ["2", "-1", "abc"]) {
      const res = await request(app).get(`/api/v1/test?scenario=timeout&failureRate=${bad}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("ignores a garbage failureRate entirely for a non-failure-representing scenario", async () => {
    const res = await request(app).get("/api/v1/test?scenario=not-found&failureRate=abc");
    expect(res.status).toBe(404);
  });

  it("reproduces an identical outcome sequence from the same starting PRNG state", async () => {
    resetStores();
    const first: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/api/v1/test?scenario=timeout&failureRate=0.5");
      first.push(res.status);
    }

    resetStores();
    const second: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/api/v1/test?scenario=timeout&failureRate=0.5");
      second.push(res.status);
    }

    expect(second).toEqual(first);
  });
});
