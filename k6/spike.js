import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";
import { issueToken, authHeader } from "./lib/auth.js";

// Spike: sudden jump to 200 VUs, held ~30s, then drop (data-model.md K6ScenarioScript, Session
// 2026-09-12 Q1/Q2). The threshold is evaluated over the whole run, so a brief backlog during the
// jump is expected -- only the run's overall/tail error rate must clear <1%.
export const options = {
  stages: [
    { duration: "5s", target: 200 },
    { duration: "25s", target: 200 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
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
}
