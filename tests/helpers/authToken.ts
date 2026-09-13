import request from "supertest";
import { app } from "../../src/app";
import type { Scope } from "../../src/models/enums";

/**
 * Issues a valid access token carrying exactly the given scopes, via the unauthenticated
 * `POST /auth/token` convenience issuer (FR-005) — the same mechanism used by scopes.test.ts.
 * Shared by the CRUD resource suites (users/products/orders/customers) now that their routes
 * require bearer-token auth.
 */
export async function issueScopedToken(scopes: Scope[]): Promise<string> {
  const res = await request(app).post("/auth/token").send({ role: "user", scopes, kind: "valid" });
  return res.body.accessToken;
}

/** Builds an `Authorization: Bearer <token>` header value pair for supertest's `.set(...)`. */
export function bearer(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}
