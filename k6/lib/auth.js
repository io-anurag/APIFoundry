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

// Issues a token directly via POST /auth/token (the unauthenticated test-convenience issuer) for
// scripts that only need a bearer token to pass the CRUD resources' auth gate and aren't otherwise
// exercising the login flow itself (that's chained-workflow.js/lib/workflow.js's job).
export function issueToken(scopes) {
  const res = http.post(
    `${BASE_URL}/auth/token`,
    JSON.stringify({ role: "admin", scopes, kind: "valid" }),
    { headers: { "Content-Type": "application/json" } }
  );
  return res.status === 200 ? res.json("accessToken") : null;
}
