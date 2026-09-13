import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";
import { issueToken, authHeader } from "./lib/auth.js";

// Stress: ramp 20 -> 100 VUs over 5 minutes (k6 ramping-VUs executor); same endpoint mix as
// load.js (data-model.md K6ScenarioScript).
export const options = {
  startVUs: 20,
  stages: [{ duration: "5m", target: 100 }],
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
  check(
    http.patch(
      `${BASE_URL}${API_PREFIX}/users/1`,
      JSON.stringify({ status: "active" }),
      { headers: { ...authed, "Content-Type": "application/json" } }
    ),
    { "patch user/1: 200": (r) => r.status === 200 }
  );
}
