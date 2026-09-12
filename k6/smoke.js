import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";

// Smoke: 1 VU / 30s sanity check across a handful of representative, lightweight endpoints
// (data-model.md K6ScenarioScript). No custom thresholds beyond k6's implicit all-checks-pass
// expectation.
export const options = { vus: 1, duration: "30s" };

export default function () {
  check(http.get(`${BASE_URL}/health`), { "health: 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}${API_PREFIX}/users`), { "users: 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}${API_PREFIX}/products`), { "products: 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}${API_PREFIX}/status/200`), { "status/200: 200": (r) => r.status === 200 });
}
