import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./lib/config.js";

// Timeout: functional script -- confirms the server's own timeout simulation completes (with the
// documented 408) instead of actually hanging the connection.
export const options = { vus: 1, iterations: 1 };

export default function () {
  check(http.get(`${BASE_URL}/api/v1/test?scenario=timeout`), {
    "test?scenario=timeout: 408": (r) => r.status === 408,
  });
  check(http.get(`${BASE_URL}/errors/timeout`), {
    "errors/timeout: 408": (r) => r.status === 408,
  });
}
