import http from "k6/http";
import { BASE_URL } from "./config.js";

// Logs in with one of src/data/demoAccounts.seed.ts's fixed demo accounts. Returns the parsed
// { accessToken, refreshToken, tokenType, expiresIn } body — never a hardcoded real secret, only
// the project's own seeded demo credentials (constitution: Secret & Credential Hygiene).
export function login(username, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  return { res, body: res.status === 200 ? res.json() : null };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
