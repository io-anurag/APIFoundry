import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./lib/config.js";
import { login, authHeader } from "./lib/auth.js";

// Auth: near-100%-pass functional script (data-model.md K6ScenarioScript) covering login,
// token expiry/revocation, and scope/role enforcement.
export const options = { vus: 1, iterations: 1 };

const JSON_HEADERS = { "Content-Type": "application/json" };

function issueToken(role, scopes, kind) {
  const res = http.post(
    `${BASE_URL}/auth/token`,
    JSON.stringify({ role, scopes, kind }),
    { headers: JSON_HEADERS }
  );
  return res.status === 200 ? res.json("accessToken") : null;
}

export default function () {
  // Valid login.
  const { res: loginRes } = login("demo.user", "user-pass-1");
  check(loginRes, { "login (valid): 200": (r) => r.status === 200 });

  // Wrong password.
  const { res: badLoginRes } = login("demo.user", "wrong-password");
  check(badLoginRes, { "login (wrong password): 401": (r) => r.status === 401 });

  // No token on a protected endpoint.
  const noTokenRes = http.get(`${BASE_URL}/auth/me`);
  check(noTokenRes, { "auth/me (no token): 401": (r) => r.status === 401 });

  // Expired token.
  const expiredToken = issueToken("user", [], "expired");
  if (expiredToken) {
    const expiredRes = http.get(`${BASE_URL}/auth/me`, { headers: authHeader(expiredToken) });
    check(expiredRes, { "auth/me (expired token): 401": (r) => r.status === 401 });
  }

  // Revoked token.
  const revokedToken = issueToken("user", [], "revoked");
  if (revokedToken) {
    const revokedRes = http.get(`${BASE_URL}/auth/me`, { headers: authHeader(revokedToken) });
    check(revokedRes, { "auth/me (revoked token): 401": (r) => r.status === 401 });
  }

  // Scope enforcement: a token with no scopes hitting a scope-gated demo endpoint.
  const noScopeToken = issueToken("user", [], "valid");
  if (noScopeToken) {
    const scopeRes = http.get(`${BASE_URL}/api/v1/scope/orders:write`, {
      headers: authHeader(noScopeToken),
    });
    check(scopeRes, {
      "scope/orders:write (no scope): 403": (r) => r.status === 403,
      "scope/orders:write: INSUFFICIENT_SCOPE": (r) => r.json("error.code") === "INSUFFICIENT_SCOPE",
    });
  }

  // Role enforcement: a "user" token against the "admin" role demo endpoint.
  const userToken = issueToken("user", [], "valid");
  if (userToken) {
    const roleRes = http.get(`${BASE_URL}/api/v1/role/admin`, { headers: authHeader(userToken) });
    check(roleRes, { "role/admin (user token): 403": (r) => r.status === 403 });
  }
}
