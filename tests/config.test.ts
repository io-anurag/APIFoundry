import { describe, it, expect } from "vitest";
import { loadConfig, ConfigValidationError } from "../src/config";

describe("config loader", () => {
  it("throws a descriptive, aggregated ConfigValidationError when PORT is non-numeric", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow(ConfigValidationError);
    try {
      loadConfig({ PORT: "not-a-number" });
      expect.fail("expected loadConfig to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as Error).message).toContain("PORT");
    }
  });

  it("throws a descriptive ConfigValidationError when PORT is out of range", () => {
    expect(() => loadConfig({ PORT: "70000" })).toThrow(ConfigValidationError);
  });

  it("loads all documented defaults when no environment variables are present", () => {
    const result = loadConfig({});
    expect(result).toMatchObject({
      port: 3000,
      nodeEnv: "development",
      apiPrefix: "/api/v1",
      corsOrigin: "*",
      jwtSecret: "change-me",
      jwtIssuer: "mock-api-server",
      jwtAudience: "mock-api-client",
      jwtExpiresIn: 3600,
      rateLimitEnabled: false,
      rateLimitRequests: 100,
      rateLimitWindowMs: 60000,
      maxDelayMs: 10000,
      maxPayloadSize: "10mb",
      failureRate: 0,
      adminToken: "admin-secret",
    });
  });
});
