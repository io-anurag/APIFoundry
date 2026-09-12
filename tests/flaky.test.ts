import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { rollFlakyOutcome } from "../src/services/flaky.service";
import { resetSeededRandom } from "../src/utils/seededRandom";
import { resetStores } from "./helpers/resetStores";

const FAILURE_STATUSES = [500, 502, 503, 504];

describe("Flaky failures (User Story 2)", () => {
  beforeEach(() => {
    resetStores();
  });

  describe("rollFlakyOutcome (unit)", () => {
    it("always succeeds when disabled, regardless of failureRate", () => {
      expect(rollFlakyOutcome(false, 1, () => 0)).toEqual({ failed: false });
    });

    it("always succeeds when failureRate is 0", () => {
      expect(rollFlakyOutcome(true, 0, () => 0.999999)).toEqual({ failed: false });
    });

    it("always fails with a status from the configured pool when failureRate is 1", () => {
      const outcome = rollFlakyOutcome(true, 1, () => 0);
      expect(outcome.failed).toBe(true);
      expect(FAILURE_STATUSES).toContain(outcome.status);
    });

    it("reproduces an identical outcome sequence from a fixed reset point", () => {
      resetSeededRandom();
      const first = Array.from({ length: 5 }, () => rollFlakyOutcome(true, 0.5));

      resetSeededRandom();
      const second = Array.from({ length: 5 }, () => rollFlakyOutcome(true, 0.5));

      expect(second).toEqual(first);
    });
  });

  describe("GET /flaky (supertest)", () => {
    it("returns 200 { ok: true } when failureRate=0", async () => {
      const res = await request(app).get("/flaky?failureRate=0");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it("returns a simulated failure status when failureRate=1", async () => {
      const res = await request(app).get("/flaky?failureRate=1");
      expect(FAILURE_STATUSES).toContain(res.status);
      expect(res.body.error.code).toBe("SIMULATED_FAILURE");
      expect(res.body.error.requestId).toBeDefined();
    });

    it.each(["2", "-1", "abc", "1e-1"])("rejects an invalid failureRate '%s' with 400", async (value) => {
      const res = await request(app).get(`/flaky?failureRate=${encodeURIComponent(value)}`);
      expect(res.status).toBe(400);
    });

    it("rejects unsupported methods", async () => {
      const res = await request(app).post("/flaky");
      expect(res.status).toBe(405);
    });
  });
});
