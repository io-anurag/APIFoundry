import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./lib/config.js";

// Error-rate: no load-shaped VU/duration threshold -- this category expects a documented *mix* of
// non-2xx statuses, not a low error rate (data-model.md K6ScenarioScript).
export const options = { vus: 1, iterations: 1 };

const FLAKY_FAILURE_RATE = 0.5;
const FLAKY_CALLS = 50;
// Tolerance band around the requested failureRate -- /flaky's outcome is drawn from a shared,
// seeded, in-process PRNG this external k6 process cannot predict call-by-call (research.md
// Decision 3), so only the aggregate proportion over a sufficient sample is asserted.
const FLAKY_MIN_RATE = 0.3;
const FLAKY_MAX_RATE = 0.7;

export default function () {
  // (a) /flaky aggregate failure-proportion check.
  let flakyFailures = 0;
  for (let i = 0; i < FLAKY_CALLS; i++) {
    const res = http.get(`${BASE_URL}/flaky?failureRate=${FLAKY_FAILURE_RATE}`);
    if (res.status !== 200) flakyFailures++;
  }
  const observedRate = flakyFailures / FLAKY_CALLS;
  check(null, {
    "flaky: aggregate failure rate is within tolerance of the requested failureRate": () =>
      observedRate >= FLAKY_MIN_RATE && observedRate <= FLAKY_MAX_RATE,
  });

  // (b) /errors/* deterministic non-2xx demos -- each is a fixed status, not a rate.
  check(http.get(`${BASE_URL}/errors/server-error`), {
    "errors/server-error: 500": (r) => r.status === 500,
  });
  check(http.get(`${BASE_URL}/errors/service-unavailable`), {
    "errors/service-unavailable: 503": (r) => r.status === 503,
  });

  // (c) Rate-limit check with a distinct X-API-Key per VU, so concurrent VUs don't collide on one
  // IP-keyed counter (resolveCallerIdentity keys by X-API-Key when present, else request IP).
  // Requires RATE_LIMIT_ENABLED=true on the target server (default: false, per .env.example) --
  // when disabled, /rate-limit always returns 200 and this block only logs a note instead of
  // asserting an impossible-by-default condition.
  const headers = { "X-API-Key": `k6-vu-${__VU}` };
  let rateLimitResponse = null;
  for (let i = 0; i < 20; i++) {
    const res = http.get(`${BASE_URL}/rate-limit`, { headers });
    if (res.status === 429) {
      rateLimitResponse = res;
      break;
    }
  }
  if (rateLimitResponse !== null) {
    check(rateLimitResponse, {
      "rate-limit: 429 carries a Retry-After header": (r) => r.headers["Retry-After"] !== undefined,
    });
  } else {
    console.log(
      "rate-limit: no 429 observed in 20 requests -- RATE_LIMIT_ENABLED is likely false on the target server"
    );
  }
}
