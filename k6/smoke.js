import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";
import { issueToken, authHeader } from "./lib/auth.js";

// Smoke: 1 VU / 30s sanity check across a handful of representative, lightweight endpoints
// (data-model.md K6ScenarioScript). No custom thresholds beyond k6's implicit all-checks-pass
// expectation.
export const options = { vus: 1, duration: "30s" };

// Runs once regardless of VU count; the resulting token is shared by every iteration below (the
// CRUD resources require bearer auth — Spec 002 auth hardening).
export function setup() {
  return { token: issueToken(["admin"]) };
}

export default function ({ token }) {
  check(http.get(`${BASE_URL}/health`), { "health: 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}${API_PREFIX}/users`, { headers: authHeader(token) }), {
    "users: 200": (r) => r.status === 200,
  });
  check(http.get(`${BASE_URL}${API_PREFIX}/products`, { headers: authHeader(token) }), {
    "products: 200": (r) => r.status === 200,
  });
  check(http.get(`${BASE_URL}${API_PREFIX}/status/200`), { "status/200: 200": (r) => r.status === 200 });
}
