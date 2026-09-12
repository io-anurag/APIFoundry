import http from "k6/http";
import { check } from "k6";
import { BASE_URL, API_PREFIX } from "./lib/config.js";

// CRUD: near-100%-pass functional script (data-model.md K6ScenarioScript) -- one full CRUD pass
// per resource, proving the full lifecycle rather than isolated calls.
export const options = { vus: 1, iterations: 1 };

const JSON_HEADERS = { "Content-Type": "application/json" };
const uniqueSuffix = () => `${__VU}-${__ITER}-${Date.now()}`;

function crudPass(resource, createBody, updateBody) {
  const base = `${BASE_URL}${API_PREFIX}/${resource}`;

  const createRes = http.post(base, JSON.stringify(createBody), { headers: JSON_HEADERS });
  check(createRes, { [`${resource}: create 201`]: (r) => r.status === 201 });
  const id = createRes.status === 201 ? createRes.json("id") : null;
  if (id === null) return;

  const getRes = http.get(`${base}/${id}`);
  check(getRes, { [`${resource}: get 200 with matching fields`]: (r) => r.status === 200 });

  const patchRes = http.patch(`${base}/${id}`, JSON.stringify(updateBody), { headers: JSON_HEADERS });
  check(patchRes, { [`${resource}: update 200`]: (r) => r.status === 200 });

  const deleteRes = http.del(`${base}/${id}`);
  check(deleteRes, { [`${resource}: delete 204`]: (r) => r.status === 204 });

  const getAfterDeleteRes = http.get(`${base}/${id}`);
  check(getAfterDeleteRes, { [`${resource}: get after delete 404`]: (r) => r.status === 404 });
}

export default function () {
  const suffix = uniqueSuffix();

  crudPass(
    "users",
    { name: "K6 CRUD User", email: `k6-crud-${suffix}@example.com`, role: "user" },
    { status: "inactive" }
  );

  crudPass(
    "products",
    { name: "K6 CRUD Product", price: 9.99, category: "electronics", stock: 5 },
    { stock: 10 }
  );

  crudPass(
    "customers",
    {
      name: "K6 CRUD Customer",
      email: `k6-crud-customer-${suffix}@example.com`,
      address: { street: "1 Main St", city: "Springfield", postalCode: "00001", country: "USA" },
    },
    { name: "K6 CRUD Customer Updated" }
  );

  crudPass(
    "orders",
    { customerId: 1, items: [{ productId: 1, quantity: 1 }] },
    { status: "processing" }
  );
}
