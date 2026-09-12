# Phase 1 Data Model: Admin & Reset

This feature introduces **no new store**. It only calls `.reset(...)` (or the equivalent seed
function) on stores/catalogs every prior spec already created, and adds one small response type and
one middleware-local credential check. Everything below documents how those existing pieces compose,
not a new schema.

## Data Reset Scope (`resetDataStores()`, called by `POST /admin/reset`)

| Subsystem | Reset call | Introduced by |
|---|---|---|
| `users` | `seedUsers()` | Spec 002 |
| `products` | `seedProducts()` | Spec 002 |
| `customers` | `seedCustomers()` | Spec 002 |
| `orders` | `seedOrders()` | Spec 002 |
| `categories` | `seedCategories()` | Spec 003 |
| `posts` | `seedPosts()` | Spec 003 |
| `comments` | `seedComments()` | Spec 003 |
| `reviews` | `seedReviews()` | Spec 003 |
| `payments` | `seedPayments()` | Spec 003 |
| Rate-limiter counters | `rateLimitStore.reset([])` | Spec 008 |
| Idempotency-key store | `idempotencyStore.reset([])` | Spec 008 |
| Cache-demo resource | `cacheResourceStore.reset()` | Spec 008 |
| Shared seeded PRNG (drives `/flaky`, `scenario=*` failure rolls) | `resetSeededRandom()` | Spec 008 |
| Uploaded files | `fileStore.reset([])` + `resetFileSequence()` | Spec 009 |

**Ordering constraint** (preserved from `tests/helpers/resetStores.ts`'s existing, test-proven
order — see research.md Decision 1): customers and products before orders; users before posts and
reviews; posts before comments; products before reviews; orders before payments. The remaining
calls (rate-limiter, idempotency, cache resource, PRNG, files) have no ordering dependency on the
seed calls or each other.

**Never touched by this function**: `sessionStore`, `apiKeyStore` — these belong exclusively to
`resetAuthStores()` (FR-008).

## Auth Reset Scope (`resetAuthStores()`, called by `POST /admin/auth/reset`)

| Subsystem | Reset call | Introduced by |
|---|---|---|
| JWT session/refresh-token records | `sessionStore.reset([])` | Spec 005 |
| Issued/revoked API keys | `apiKeyStore.reset([])` | Spec 006 |

**Never touched by this function**: every store listed under Data Reset Scope above — resetting
auth state MUST NOT alter any resource collection, rate-limit counters, idempotency records, the
cache-demo resource, the shared PRNG's state, or uploaded files (FR-011).

Note: neither function needs to reset the static demo/convenience accounts (`demoAccounts.seed.ts`)
or role/scope definitions (`src/models/enums.ts`, `src/auth/scopes.ts`) — those are read-only
constants, never mutated at runtime, so User Story 2's acceptance scenario ("the project's
documented convenience/demo credentials work exactly as they did on a fresh server start") is already
satisfied the moment `sessionStore`/`apiKeyStore` no longer hold any stale issued/revoked record that
could shadow them.

## AdminResetResult (new response model)

```ts
export interface AdminResetResult {
  message: string;
  domain: "data" | "auth";
  requestId: string;
}
```

- `message`: a human-readable confirmation (`"Data reset to seed state"` /
  `"Auth state reset to initial configuration"`) — fixed per endpoint, not caller-influenced.
- `domain`: which reset scope ran; lets a single client-side assertion helper distinguish the two
  endpoints' responses without string-matching `message`.
- `requestId`: same value as the response's `X-Request-ID` header (FR-013), included in the body per
  this project's existing convention for request-scoped confirmation bodies.

No `details`/counts/timestamp fields — resolved by the Clarifications session (FR-013).

## Admin Credential (middleware-local, no new store)

Not a persisted entity — `adminAuth` middleware compares the incoming `X-Admin-Token` header
against `config.adminToken` (parsed once at startup from the `ADMIN_TOKEN` environment variable,
Spec 001) on every request to either endpoint. No state is created, read, or mutated beyond that
single comparison.

| Header state | Outcome |
|---|---|
| Missing or empty string | `401 UNAUTHORIZED` |
| Present, non-empty, not equal to `config.adminToken` | `403 FORBIDDEN` |
| Present and equal to `config.adminToken` | Request proceeds to the controller |
