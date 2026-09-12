# Phase 1 Data Model: Resilience Simulation

Three new pieces of mutable server-side state (rate-limit counters, idempotency records, the
single cache-demo resource), plus one computed-not-stored entity (a flaky outcome) and one
extension to an existing entity (`Payment` gains a write path). Every store below exposes
`reset()`, following the exact convention every existing store in this project already uses.

## RateLimitCounter (mutable, keyed store)

```ts
export interface RateLimitCounter {
  id: string;         // caller identity: X-API-Key header value, else req.ip
  count: number;       // requests seen in the current window
  windowStart: number; // epoch ms when the current window began
}
```

Stored in `rateLimitStore = createKeyedStore<RateLimitCounter>()` (`src/data/rateLimit.store.ts`).
Lifecycle: created on a caller's first `GET /rate-limit`; replaced with a fresh
`{ count: 1, windowStart: now }` whenever `now >= windowStart + RATE_LIMIT_WINDOW_MS`; otherwise
`count` increments in place (research.md Decision 1). `reset()` (via `rateLimitStore.reset([])`)
clears every caller's state — called by `tests/helpers/resetStores.ts` and, once it exists, Spec
011's admin-reset endpoint (FR-022).

## IdempotencyRecord (mutable, keyed store)

```ts
export interface IdempotencyRecord {
  id: string;          // the raw Idempotency-Key header value
  requestHash: string;  // sha256 of the canonicalized (sorted-key) request body JSON
  statusCode: 201;       // the status originally returned (always 201 — only successful creates are recorded)
  payment: Payment;      // the resulting Payment record, replayed verbatim on an identical retry
}
```

Stored in `idempotencyStore = createKeyedStore<IdempotencyRecord>()`
(`src/data/idempotency.store.ts`). Lifecycle: created only after a `POST /api/v1/payments` request
passes body validation and successfully creates a new `Payment` (research.md Decision 3); never
created for a request that fails validation (FR-010), so an invalid body never "poisons" a key for
a later, correctly-shaped retry. No time-based expiry (Clarifications) — persists for the process
lifetime, cleared only by `reset()` (`tests/helpers/resetStores.ts` today; Spec 011's admin-reset
once it exists, FR-022).

## FlakyOutcome (computed, not stored)

```ts
interface FlakyOutcome {
  failed: boolean;
  status?: 500 | 502 | 503 | 504; // present only when failed is true
}
```

Produced by `rollFlakyOutcome(failureRate)` in `src/services/flaky.service.ts`, drawing from the
shared seeded PRNG (research.md Decision 5). Nothing about a single outcome is persisted; only the
PRNG's internal state carries forward between calls, and that state itself is reset the same way
every other store is (`resetSeededRandom()`).

## CacheResource (mutable, singleton — not a keyed collection)

```ts
export interface CacheResource {
  content: unknown;   // arbitrary JSON-serializable demo content
  version: number;     // starts at 1; incremented on every PUT
  updatedAt: string;   // ISO 8601 timestamp of the last PUT (or seed time)
}
```

Held as a single module-level record in `src/data/cacheResource.store.ts` (not `createKeyedStore`
— there is exactly one resource, not a collection), exposing `get()`, `update(content)`, and
`reset()`. `ETag` is derived as `` `"v${version}"` `` and `Last-Modified` as `updatedAt`
(research.md Decision 6) — both recomputed from `version`/`updatedAt`, never stored redundantly.
`reset()` restores the fixed seed content/version/timestamp — called by
`tests/helpers/resetStores.ts` and, eventually, Spec 011's admin-reset.

## Payment (extended from Spec 003 — reused schema, new write path)

Unchanged shape (`id: string (uuid)`, `orderId: number`, `amount: number`,
`status: "pending" | "completed" | "failed" | "refunded"`, `processedAt: string (date)`,
`createdAt: string (date-time)`). This spec adds `createPaymentIdempotently(idempotencyKey, body)`
in the existing `payment.service.ts`, which is the only place that calls `paymentStore.create(...)`
for a payment triggered by this feature (Spec 003's payments remain seed-only otherwise).

## Validation rules (from Functional Requirements)

- `GET /rate-limit`: no request body/params to validate; caller identity resolved from
  `X-API-Key` header (if present) else `req.ip` — never rejected for malformed identity (FR-001).
- `GET /flaky?failureRate=`: when `config.flakyEnabled` is `false`, always `200`, without
  evaluating `failureRate` at all (FR-008, research.md Decision 9). Otherwise, `failureRate` —
  optional; when present, a decimal string parseable as a number in `[0, 1]` → else `400` (FR-006).
  Omitted → defaults to `config.failureRate`.
- `POST /api/v1/payments`: requires `Idempotency-Key` header (non-empty string) → else `400`
  (FR-009). Body — `createPaymentRequestSchema` (`.strict()`): `orderId: z.number().int().positive()`,
  `amount: z.number().nonnegative()`, `status: z.enum(PAYMENT_STATUSES)` → invalid/missing/wrong
  type → `400`/`422` (FR-010), without writing an `IdempotencyRecord` for that attempt.
- `GET /cache/resource`: no body; conditional headers (`If-None-Match`, `If-Modified-Since`) are
  optional and never rejected as malformed — a bad value simply fails to match (FR-016/FR-017,
  Edge Cases).
- `PUT /cache/resource`: body — `cacheResourceUpdateSchema` (`.strict()`):
  `content: z.unknown()` required (any JSON value) → missing/absent `content` key → `400`
  (FR-018).
