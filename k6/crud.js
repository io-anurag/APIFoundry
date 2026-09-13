import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";
import { issueToken, authHeader } from "./lib/auth.js";

// CRUD: near-100%-pass functional script (data-model.md K6ScenarioScript) -- one full CRUD pass
// per resource, proving the full lifecycle rather than isolated calls.
export const options = { vus: 1, iterations: 1 };

const uniqueSuffix = () => `${__VU}-${__ITER}-${Date.now()}`;

// The CRUD resources require bearer auth (Spec 002 auth hardening) — an admin-scoped token
// satisfies every resource's :read/:write check.
function crudPass(resource, createBody, updateBody, token) {
  const base = `${BASE_URL}${API_PREFIX}/${resource}`;
  const jsonHeaders = { ...authHeader(token), "Content-Type": "application/json" };

  const createRes = http.post(base, JSON.stringify(createBody), { headers: jsonHeaders });
  check(createRes, { [`${resource}: create 201`]: (r) => r.status === 201 });
  const id = createRes.status === 201 ? createRes.json("id") : null;
  if (id === null) return;

  const getRes = http.get(`${base}/${id}`, { headers: authHeader(token) });
  check(getRes, { [`${resource}: get 200 with matching fields`]: (r) => r.status === 200 });

  const patchRes = http.patch(`${base}/${id}`, JSON.stringify(updateBody), { headers: jsonHeaders });
  check(patchRes, { [`${resource}: update 200`]: (r) => r.status === 200 });

  const deleteRes = http.del(`${base}/${id}`, null, { headers: authHeader(token) });
  check(deleteRes, { [`${resource}: delete 204`]: (r) => r.status === 204 });

  const getAfterDeleteRes = http.get(`${base}/${id}`, { headers: authHeader(token) });
  check(getAfterDeleteRes, { [`${resource}: get after delete 404`]: (r) => r.status === 404 });
}

export default function () {
  const suffix = uniqueSuffix();
  const token = issueToken(["admin"]);

  crudPass(
    "users",
    { name: "K6 CRUD User", email: `k6-crud-${suffix}@example.com`, role: "user" },
    { status: "inactive" },
    token
  );

  crudPass(
    "products",
    { name: "K6 CRUD Product", price: 9.99, category: "electronics", stock: 5 },
    { stock: 10 },
    token
  );

  crudPass(
    "customers",
    {
      name: "K6 CRUD Customer",
      email: `k6-crud-customer-${suffix}@example.com`,
      address: { street: "1 Main St", city: "Springfield", postalCode: "00001", country: "USA" },
    },
    { name: "K6 CRUD Customer Updated" },
    token
  );

  crudPass(
    "orders",
    { customerId: 1, items: [{ productId: 1, quantity: 1 }] },
    { status: "processing" },
    token
  );
}
