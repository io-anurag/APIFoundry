import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";

// Soak: 20 VUs for 30 minutes -- same lightweight endpoint mix as load.js, run long enough to
// surface any slow memory growth or leak (data-model.md K6ScenarioScript).
export const options = {
  vus: 20,
  duration: "30m",
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
