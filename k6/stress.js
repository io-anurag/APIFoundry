import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";

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

export default function () {
  check(http.get(`${BASE_URL}${API_PREFIX}/users`), { "users: 200": (r) => r.status === 200 });
  check(http.get(`${BASE_URL}${API_PREFIX}/products`), { "products: 200": (r) => r.status === 200 });
  check(
    http.patch(
      `${BASE_URL}${API_PREFIX}/users/1`,
      JSON.stringify({ status: "active" }),
      { headers: { "Content-Type": "application/json" } }
    ),
    { "patch user/1: 200": (r) => r.status === 200 }
  );
}
