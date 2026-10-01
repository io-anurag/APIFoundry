import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { config } from "../src/config";
import type { Scope } from "../src/models/enums";
import { resetStores } from "./helpers/resetStores";
import { issueScopedToken, bearer } from "./helpers/authToken";

/**
 * Per-resource scope hierarchy on the four core resources: `:read` grants GET, `:write` adds
 * POST/PUT/PATCH, `:execute` adds DELETE. `admin` grants everything.
 */
// `body(n)` varies the email so repeated creates within one test don't trip uniqueness checks.
const RESOURCES = [
  { name: "users", body: (n: number) => ({ name: "Scope Probe", email: `scope.probe${n}@example.com`, role: "user" }) },
  { name: "products", body: () => ({ name: "Scope Probe", price: 1, category: "electronics", stock: 1 }) },
  { name: "orders", body: () => ({ customerId: 1, items: [{ productId: 1, quantity: 1 }] }) },
  {
    name: "customers",
    body: (n: number) => ({
      name: "Scope Probe",
      email: `scope.probe${n}@example.com`,
      address: { street: "1 Main St", city: "Springfield", postalCode: "00001", country: "USA" },
    }),
  },
] as const;

describe("Core resource scope hierarchy (read < write < execute)", () => {
  beforeEach(() => {
    resetStores();
  });

  for (const { name, body } of RESOURCES) {
    const base = `${config.apiPrefix}/${name}`;

    /** Creates a fresh record with an admin token so DELETE has a target that is safe to remove. */
    async function createRecord(): Promise<number | string> {
      const admin = await issueScopedToken(["admin"]);
      const res = await request(app).post(base).set(...bearer(admin)).send(body(0));
      expect(res.status).toBe(201);
      return res.body.id;
    }

    describe(name, () => {
      it(`${name}:read grants GET but not POST or DELETE`, async () => {
        const token = await issueScopedToken([`${name}:read` as Scope]);
        expect((await request(app).get(base).set(...bearer(token))).status).toBe(200);
        expect((await request(app).post(base).set(...bearer(token)).send(body(1))).status).toBe(403);

        const id = await createRecord();
        const del = await request(app).delete(`${base}/${id}`).set(...bearer(token));
        expect(del.status).toBe(403);
        expect(del.body.error.code).toBe("INSUFFICIENT_SCOPE");
      });

      it(`${name}:write grants GET and POST but not DELETE`, async () => {
        const token = await issueScopedToken([`${name}:write` as Scope]);
        expect((await request(app).get(base).set(...bearer(token))).status).toBe(200);
        expect((await request(app).post(base).set(...bearer(token)).send(body(1))).status).toBe(201);

        const id = await createRecord();
        const del = await request(app).delete(`${base}/${id}`).set(...bearer(token));
        expect(del.status).toBe(403);
        expect(del.body.error.code).toBe("INSUFFICIENT_SCOPE");
        expect(del.body.error.details.requiredScope).toBe(`${name}:execute`);
      });

      it(`${name}:execute grants GET, POST, and DELETE`, async () => {
        const token = await issueScopedToken([`${name}:execute` as Scope]);
        expect((await request(app).get(base).set(...bearer(token))).status).toBe(200);
        expect((await request(app).post(base).set(...bearer(token)).send(body(1))).status).toBe(201);

        const id = await createRecord();
        expect((await request(app).delete(`${base}/${id}`).set(...bearer(token))).status).toBe(204);
      });

      it(`admin grants DELETE on ${name}`, async () => {
        const token = await issueScopedToken(["admin"]);
        const id = await createRecord();
        expect((await request(app).delete(`${base}/${id}`).set(...bearer(token))).status).toBe(204);
      });
    });
  }
});
