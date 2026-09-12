import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";

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

export default function () {
  check(http.get(`${BASE_URL}${API_PREFIX}/users`), { "users: 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}${API_PREFIX}/products`), { "products: 200": (r) => r.status === 200 });
  // Light write mix on a fixed seeded id — reversible, never removes a seeded row.
  check(
    http.patch(
      `${BASE_URL}${API_PREFIX}/users/1`,
      JSON.stringify({ status: "active" }),
      { headers: { "Content-Type": "application/json" } }
    ),
    { "patch user/1: 200": (r) => r.status === 200 }
  );
}
