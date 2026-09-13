import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./config.js";
import { login, authHeader } from "./auth.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * FR-008's named chained-workflow sequence: login -> own profile -> list -> get -> update ->
 * create order -> get order -> delete user.
 *
 * One adaptation from a literal reading of the sequence: the "delete user" step targets a
 * disposable user created earlier in this same function, not the seeded user read/updated a few
 * steps before it. Deleting an arbitrary *seeded* user would permanently shrink the fixed 50-user
 * seed pool every time this runs (especially at concurrent-user.js's 50 VUs), eventually breaking
 * other tests/scripts that assume >=50 seeded users exist. spec.md's own Acceptance Scenario 3
 * only requires that the workflow "...creates an order, fetches the created order by its returned
 * ID, and deletes **a** user" - not necessarily the same one just read/updated - so this keeps
 * every step's input drawn from a real prior response while leaving seed data intact across
 * repeated/concurrent runs.
 */
export function runChainedWorkflow() {
  // 1. Login as demo.admin (src/data/demoAccounts.seed.ts).
  const { res: loginRes, body: loginBody } = login("demo.admin", "admin-pass-1");
  check(loginRes, { "login: 200": (r) => r.status === 200 });
  if (!loginBody) return;
  const token = loginBody.accessToken;

  // 2. GET /auth/me with the returned token.
  const meRes = http.get(`${BASE_URL}/auth/me`, { headers: authHeader(token) });
  check(meRes, {
    "auth/me: 200": (r) => r.status === 200,
    "auth/me: identity matches": (r) => r.json("sub") === "demo.admin",
  });

  // Steps 3-9 all hit the CRUD resources, which require bearer auth (Spec 002 auth hardening);
  // demo.admin's "admin" scope (src/data/demoAccounts.seed.ts) satisfies every :read/:write check.
  const authed = authHeader(token);
  const authedJsonHeaders = { ...authed, ...JSON_HEADERS };

  // 3. List users.
  const listRes = http.get(`${BASE_URL}${API_PREFIX}/users?page=1&limit=5`, { headers: authed });
  check(listRes, { "list users: 200": (r) => r.status === 200 });
  const listedUsers = listRes.status === 200 ? listRes.json("data") : [];
  if (!listedUsers || listedUsers.length === 0) return;
  const listedUserId = listedUsers[0].id;

  // 4. Get that user by the id drawn from the list response.
  const getRes = http.get(`${BASE_URL}${API_PREFIX}/users/${listedUserId}`, { headers: authed });
  check(getRes, { "get user: 200": (r) => r.status === 200 });

  // 5. Update that same user (reversible; safe under concurrency/soak).
  const patchRes = http.patch(
    `${BASE_URL}${API_PREFIX}/users/${listedUserId}`,
    JSON.stringify({ status: "inactive" }),
    { headers: authedJsonHeaders }
  );
  check(patchRes, { "update user: 200": (r) => r.status === 200 });

  // 6. Create an order.
  const orderRes = http.post(
    `${BASE_URL}${API_PREFIX}/orders`,
    JSON.stringify({ customerId: 1, items: [{ productId: 1, quantity: 1 }] }),
    { headers: authedJsonHeaders }
  );
  check(orderRes, { "create order: 201": (r) => r.status === 201 });
  const orderId = orderRes.status === 201 ? orderRes.json("id") : null;

  // 7. Get the created order by its returned id.
  if (orderId !== null) {
    const getOrderRes = http.get(`${BASE_URL}${API_PREFIX}/orders/${orderId}`, { headers: authed });
    check(getOrderRes, { "get order: 200": (r) => r.status === 200 });
  }

  // 8. Create a disposable, per-iteration-unique user specifically to delete (see rationale above).
  const disposableEmail = `k6-${__VU}-${__ITER}-${Date.now()}@example.com`;
  const createUserRes = http.post(
    `${BASE_URL}${API_PREFIX}/users`,
    JSON.stringify({ name: "K6 Disposable User", email: disposableEmail, role: "user" }),
    { headers: authedJsonHeaders }
  );
  check(createUserRes, { "create disposable user: 201": (r) => r.status === 201 });
  const disposableUserId = createUserRes.status === 201 ? createUserRes.json("id") : null;

  // 9. Delete that disposable user.
  if (disposableUserId !== null) {
    const deleteRes = http.del(`${BASE_URL}${API_PREFIX}/users/${disposableUserId}`, null, { headers: authed });
    check(deleteRes, { "delete user: 204": (r) => r.status === 204 });
  }
}
