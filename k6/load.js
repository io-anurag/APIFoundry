import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";
import { issueToken, authHeader } from "./lib/auth.js";

// Load: 20 VUs steady for 2 minutes; p95 request duration <500ms and HTTP error rate <1% on
// lightweight endpoints (data-model.md K6ScenarioScript, Session 2026-09-12 Q1/Q2).
export const options = {
  vus: 20,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

// Runs once regardless of VU count; the resulting token is shared by every iteration below (the
// CRUD resources require bearer auth — Spec 002 auth hardening).
export function setup() {
  return { token: issueToken(["admin"]) };
}

export default function ({ token }) {
  const authed = authHeader(token);
  check(http.get(`${BASE_URL}${API_PREFIX}/users`, { headers: authed }), {
    "users: 200": (r) => r.status === 200,
  });
  check(http.get(`${BASE_URL}${API_PREFIX}/products`, { headers: authed }), {
    "products: 200": (r) => r.status === 200,
  });
  // Light write mix on a fixed seeded id — reversible, never removes a seeded row.
  check(
    http.patch(
      `${BASE_URL}${API_PREFIX}/users/1`,
      JSON.stringify({ status: "active" }),
      { headers: { ...authed, "Content-Type": "application/json" } }
    ),
    { "patch user/1: 200": (r) => r.status === 200 }
  );
}
