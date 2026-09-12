import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./lib/config.js";

// Latency: functional, not load-shaped (data-model.md K6ScenarioScript) -- no VU/duration
// threshold. Asserts observed latency tracks the requested delay and stays bounded by
// MAX_DELAY_MS.
export const options = { vus: 1, iterations: 1 };

const REQUESTED_DELAY_MS = 500;
const OVER_MAX_DELAY_MS = 999999; // well above the default MAX_DELAY_MS (10000)

export default function () {
  const delayRes = http.get(`${BASE_URL}/delay/${REQUESTED_DELAY_MS}`);
  check(delayRes, {
    "delay: 200": (r) => r.status === 200,
    "delay: observed duration tracks the requested delay": (r) =>
      r.timings.duration >= REQUESTED_DELAY_MS * 0.9,
  });

  const scenarioRes = http.get(
    `${BASE_URL}/api/v1/test?scenario=delayed&delay=${REQUESTED_DELAY_MS}`
  );
  check(scenarioRes, {
    "test?scenario=delayed: 200": (r) => r.status === 200,
    "test?scenario=delayed: observed duration tracks the requested delay": (r) =>
      r.timings.duration >= REQUESTED_DELAY_MS * 0.9,
  });

  // A delay above MAX_DELAY_MS must be rejected (400), not honored -- constitution's
  // bounded-resource-usage principle.
  const overMaxRes = http.get(`${BASE_URL}/delay/${OVER_MAX_DELAY_MS}`);
  check(overMaxRes, { "delay over MAX_DELAY_MS: 400": (r) => r.status === 400 });
}
