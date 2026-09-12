# Phase 0 Research: Admin & Reset

No `[NEEDS CLARIFICATION]` markers remain in spec.md — both open questions (admin credential
delivery, reset response shape) were resolved during `/speckit-clarify`. This document instead
records the non-obvious implementation decisions the plan depends on, each grounded in what the
existing codebase (Specs 001-010) already established.

## Decision 1: Reuse `tests/helpers/resetStores.ts`'s existing call sequence, split by domain

**Decision**: Introduce `src/services/admin.service.ts` exporting `resetDataStores()` and
`resetAuthStores()`. Each is a direct extraction of half of `resetStores()`'s existing body:

```ts
// resetDataStores() — everything except sessionStore/apiKeyStore
seedUsers(); seedProducts(); seedCustomers(); seedOrders(); seedCategories();
seedPosts(); seedComments(); seedReviews(); seedPayments();
rateLimitStore.reset([]); resetSeededRandom(); idempotencyStore.reset([]);
cacheResourceStore.reset(); fileStore.reset([]); resetFileSequence();

// resetAuthStores() — the two domains resetStores() also resets, moved here
sessionStore.reset([]); apiKeyStore.reset([]);
```

Then `tests/helpers/resetStores.ts` is refactored to `resetDataStores(); resetAuthStores();` —
identical net effect for every existing test, but now delegating to the same code the production
endpoints call.

**Rationale**: `tests/helpers/resetStores.ts` (introduced across Specs 002-009 as each store was
added) already *is* a complete, working, test-proven "reset everything" implementation — it is
called in `beforeEach` across the existing suite and known to leave every store correctly reseeded
in dependency order (its own header comment documents the seeding order: customers/products before
orders, posts before comments, users before posts/reviews, orders before payments). Reimplementing
that sequence from scratch for the admin endpoints would create two places that must be kept in sync
by hand as future specs add stores; extracting it once and having both the test helper and the new
endpoints call the same two functions makes drift structurally impossible.

**Alternatives considered**:
- *Duplicate the sequence directly in `admin.service.ts`, leave the test helper untouched.*
  Rejected — the two copies would silently diverge the next time a spec adds a store and only one
  of them is updated; this is exactly the kind of drift the constitution's spec-parity spirit warns
  against.
- *Have `resetStores()` (the test helper) call into `admin.service.ts`, but keep `admin.service.ts`'s
  functions private/unexported.* Rejected — the endpoint's controller needs to call them directly
  too, so they must be exported regardless; there is no benefit to hiding them from the test helper
  once they exist.

## Decision 2: Admin credential enforcement as a small dedicated middleware, not scope/role reuse

**Decision**: `src/middleware/adminAuth.ts` reads the `X-Admin-Token` header and compares it directly
against `config.adminToken` (already parsed/validated by `src/config/env.schema.ts` since Spec 001).
Missing or empty header → `401 UNAUTHORIZED`. Present but not equal → `403 FORBIDDEN`. Equal → `next()`.

**Rationale**: This mirrors `src/middleware/apiKeyAuth.ts`'s existing 401-reason-then-lookup shape
(missing → 401; present-but-invalid → the next-more-specific rejection) without needing that
middleware's store lookup, since there is exactly one admin credential, not a keyed collection of
them. Reusing the JWT role/scope machinery (`requireRole("admin")`) was considered and rejected
because it would require the caller to have already authenticated as a *user* with the admin role —
conflating "an operator resetting the mock server's own state" with "a application user who happens
to hold the admin role," which are different trust boundaries in this project's own model (a
JWT-authenticated admin *user* is exactly the kind of mutable, resettable state this feature exists
to wipe out; the reset capability itself must not depend on state it resets).

**Alternatives considered**:
- *`Authorization: Bearer <ADMIN_TOKEN>`.* Rejected during `/speckit-clarify` — risks confusion with
  real JWTs in test tooling that already expects `Authorization: Bearer` to carry a JWT.
- *Timing-safe comparison (`crypto.timingSafeEqual`).* Rejected — no other shared-secret comparison
  in this codebase (`JWT_SECRET` verification via `jsonwebtoken`, `X-API-Key` store lookup) uses a
  timing-safe compare either; introducing one here alone would be inconsistent with the project's
  established security posture for a mock/testing server, not a materially safer production system.

## Decision 3: Response body — reuse the plain-object pattern, no shared "success envelope" type

**Decision**: `POST /admin/reset` responds `200 { message: "Data reset to seed state", domain: "data",
requestId }`; `POST /admin/auth/reset` responds `200 { message: "Auth state reset to initial
configuration", domain: "auth", requestId }`. A new `AdminResetResult` model
(`src/models/adminResetResult.ts`) types this shape; no new project-wide "success envelope" is
introduced.

**Rationale**: This project has no single shared success-response type — every endpoint's success
body is its own bespoke shape (`{ granted, keyId, label }` for `/api-key/protected`, `{}` for
`/auth/api-key/revoke`, etc.), matching FR-013's clarified requirement for a "simple acknowledgment"
with no per-subsystem counts or timestamp. `requestId` is included in the body (in addition to the
`X-Request-ID` header every response already carries) purely because it costs nothing and every
other endpoint that returns a request-scoped confirmation body already does the same via
`requestIdOf(req)`.

**Alternatives considered**: Already resolved during `/speckit-clarify` — counts-per-subsystem and a
timestamp field were both explicitly rejected in favor of the simple acknowledgment.

## Decision 4: Route mounting — top-level, outside `/api/v1`, alongside other operational endpoints

**Decision**: `admin.routes.ts` is mounted in `app.ts` alongside `authRouter`, `apiKeyRouter`,
`errorsRouter`, etc. — outside `config.apiPrefix`.

**Rationale**: CLAUDE.md's own endpoint list (`POST /admin/reset`, `POST /admin/auth/reset`) never
prefixes these with `/api/v1`, and every other cross-cutting operational endpoint in this project
(`/auth/*`, `/api-key/*`, `/errors/*`, `/rate-limit`, `/flaky`) already lives at the top level for
the same reason: it is infrastructure for testing the API, not itself a versioned resource.

**Alternatives considered**: Mounting under `/api/v1/admin/reset`. Rejected — contradicts CLAUDE.md's
literal endpoint paths and the project's established convention for operational vs. resource
endpoints.
