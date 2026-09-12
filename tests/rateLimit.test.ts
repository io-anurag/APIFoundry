import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import { checkRateLimit } from "../src/services/rateLimit.service";
import { resetStores } from "./helpers/resetStores";

describe("Rate limiting (User Story 1)", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("checkRateLimit (unit)", () => {
    it("never touches state and always allows when disabled", () => {
      const result = checkRateLimit("caller-disabled", false, 3, 1000);
      expect(result).toEqual({ allowed: true, remaining: 3, limit: 3, retryAfterSec: 0 });
    });

    it("enforces the threshold within a window and resets after it elapses", () => {
      const first = checkRateLimit("caller-a", true, 3, 1000, 0);
      expect(first).toEqual({ allowed: true, remaining: 2, limit: 3, retryAfterSec: 0 });

      const second = checkRateLimit("caller-a", true, 3, 1000, 10);
      expect(second).toEqual({ allowed: true, remaining: 1, limit: 3, retryAfterSec: 0 });

      const third = checkRateLimit("caller-a", true, 3, 1000, 20);
      expect(third).toEqual({ allowed: true, remaining: 0, limit: 3, retryAfterSec: 0 });

      const fourth = checkRateLimit("caller-a", true, 3, 1000, 30);
      expect(fourth.allowed).toBe(false);
      expect(fourth.remaining).toBe(0);
      expect(fourth.retryAfterSec).toBe(Math.ceil((1000 - 30) / 1000));

      const afterWindow = checkRateLimit("caller-a", true, 3, 1000, 1001);
      expect(afterWindow).toEqual({ allowed: true, remaining: 2, limit: 3, retryAfterSec: 0 });
    });

    it("tracks independent callers independently", () => {
      checkRateLimit("caller-x", true, 1, 1000, 0);
      const other = checkRateLimit("caller-y", true, 1, 1000, 0);
      expect(other.allowed).toBe(true);
      expect(other.remaining).toBe(0);
    });
  });

  describe("GET /rate-limit (supertest)", () => {
    it("returns 200 with the remaining quota under the real default config", async () => {
      const res = await request(app).get("/rate-limit");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ remaining: config.rateLimitRequests, limit: config.rateLimitRequests });
      expect(res.headers["x-request-id"]).toBeDefined();
    });

    it("rejects unsupported methods", async () => {
      const res = await request(app).post("/rate-limit");
      expect(res.status).toBe(405);
    });
  });
});
