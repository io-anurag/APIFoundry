---

description: "Task list template for feature implementation"
---

# Tasks: Resilience Simulation

**Input**: Design documents from `/specs/008-resilience-simulation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/resilience-simulation.openapi.yaml](contracts/resilience-simulation.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations explicitly names "rate limiting,"
"idempotency," and "ETags" as required automated-suite coverage, and the constitution's Quality
Gates ("new or changed endpoints MUST include corresponding automated test coverage ... before
being considered done") make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. All four of this feature's user stories (rate limiting,
flaky failures, idempotent payments, caching) are fully independent of one another — each touches
its own new set of files, except that all four additively extend `tests/helpers/resetStores.ts`
(one new `reset()` call each) and three of the four additively extend `src/app.ts` (one new
top-level router mount each). User Story 3 (idempotent payments) is the only story that extends an
existing Spec 003 file (`payment.service.ts`/`payment.controller.ts`/`payment.routes.ts`) rather
than creating new ones.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US4)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-007 layout. No new top-level directories. `src/app.ts` and `tests/helpers/resetStores.ts` are
the only shared, cross-cutting files touched — both only additively (one new import + one new
mount/reset call per story); `payment.service.ts`, `payment.controller.ts`, and
`payment.routes.ts` (Spec 003) are extended by User Story 3 only; no other Spec 001-007
resource/feature file is touched.

---

## Phase 1: Setup

**Purpose**: Project initialization and new dependencies.

No tasks. This feature adds no new npm dependency — `Idempotency-Key` hashing uses Node's
built-in `node:crypto`, and the seeded PRNG for `/flaky` is a ~10-line hand-rolled function
(research.md Decisions 3-5). Proceed directly to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

No tasks. Unlike Spec 007 (where `MAX_PAYLOAD_SIZE` wiring blocked two stories), none of this
feature's four user stories share a blocking prerequisite — each depends only on Spec 001's
already-built foundation (config, error envelope, request-id middleware) and, for User Story 3
specifically, on Spec 003's already-built `payments` domain. All four stories can start
immediately and proceed in any order or in parallel.

---

## Phase 3: User Story 1 - Trigger and Recover From Rate Limiting (Priority: P1) 🎯 MVP

**Goal**: `GET /rate-limit` tracks a per-caller request count against a configurable
threshold/window, returning `200` with remaining quota under the threshold and `429` +
`Retry-After` past it, resetting deterministically once the window elapses.

**Independent Test**: Call the endpoint under the threshold (expect `200`), exceed it (expect
`429` + `Retry-After`), and confirm the limit resets after the window elapses. See quickstart.md
Scenario 1.

### Implementation for User Story 1

- [X] T001 [P] [US1] Create `src/models/rateLimitCounter.ts`: `export interface RateLimitCounter {
      id: string; count: number; windowStart: number; }` (data-model.md — `id` is the caller
      identity string, `count` is requests seen in the current window, `windowStart` is the epoch
      ms the current window began).
- [X] T002 [P] [US1] Create `src/data/rateLimit.store.ts`: `import { createKeyedStore } from
      "./keyedStore"; import type { RateLimitCounter } from "../models/rateLimitCounter"; export
      const rateLimitStore = createKeyedStore<RateLimitCounter>();` (research.md Decision 1 —
      reuses the existing generic string-keyed store, exactly as `apiKeyStore` already does).
- [X] T003 [P] [US1] Create `src/utils/callerIdentity.ts`: `resolveCallerIdentity(req: Request):
      string` — returns the `X-API-Key` header value if present and non-empty, else `req.ip`
      (spec.md Assumptions — per-caller identity for rate limiting, since `GET /rate-limit` itself
      requires no authentication).
- [X] T004 [US1] Create `src/services/rateLimit.service.ts` (depends on T002): export
      `checkRateLimit(callerId: string, enabled: boolean, limit: number, windowMs: number, now:
      number = Date.now()): { allowed: boolean; remaining: number; limit: number; retryAfterSec:
      number }`. When `enabled` is `false`, return `{ allowed: true, remaining: limit, limit,
      retryAfterSec: 0 }` immediately, **without reading or writing `rateLimitStore`** (FR-004 —
      disabled mode must not accumulate any counter state). Otherwise: read
      `rateLimitStore.get(callerId)`; if missing or `now >= existing.windowStart + windowMs`,
      build a fresh record `{ id: callerId, count: 1, windowStart: now }`; else build `{ id:
      callerId, count: existing.count + 1, windowStart: existing.windowStart }`; write it back via
      `rateLimitStore.create(record)` (if it was missing) or `rateLimitStore.replace(callerId, ()
      => record)` (if it existed); `allowed = record.count <= limit`; `remaining = Math.max(0,
      limit - record.count)`; `retryAfterSec = allowed ? 0 : Math.ceil((record.windowStart +
      windowMs - now) / 1000)` (FR-001, FR-002, FR-003, research.md Decision 2). Takes `enabled`,
      `limit`, `windowMs`, and `now` as explicit parameters (not read from the global `config`
      singleton) specifically so automated tests can exercise the threshold/window-rollover/reset
      logic deterministically and instantly — by passing explicit `now` timestamps — instead of
      needing `RATE_LIMIT_ENABLED=true` in the real environment or a real 60-second sleep; the
      controller (T005) supplies the real `config` values as arguments.
- [X] T005 [US1] Create `src/controllers/rateLimit.controller.ts` (depends on T004, T003):
      `getRateLimit(req: Request, res: Response): void` — calls `checkRateLimit
      (resolveCallerIdentity(req), config.rateLimitEnabled, config.rateLimitRequests,
      config.rateLimitWindowMs)`; when `!result.allowed`, `res.set("Retry-After",
      String(result.retryAfterSec)).status(429).json(buildErrorEnvelope("RATE_LIMIT_EXCEEDED",
      "Rate limit exceeded for this caller.", requestIdOf(req)))` (builds the envelope directly
      rather than throwing `HttpError`, since the shared `errorHandler` has no mechanism to attach
      a response header — FR-002); otherwise `res.status(200).json({ remaining: result.remaining,
      limit: result.limit })` (FR-001).
- [X] T006 [US1] Create `src/routes/rateLimit.routes.ts` (depends on T005): `export const
      rateLimitRouter = Router({ strict: true });` mount `GET /rate-limit` →
      `rateLimitController.getRateLimit`; `rateLimitRouter.all("/rate-limit",
      methodNotAllowedHandler)`.
- [X] T007 [US1] Wire `rateLimitRouter` into `src/app.ts` (depends on T006): mount it top-level
      (alongside `delayRouter`/`payloadRouter`/etc. from Spec 007), matching CLAUDE.md's
      `/rate-limit` path spelling (no `/api/v1` prefix — spec.md Assumptions).
- [X] T008 [US1] Extend `tests/helpers/resetStores.ts` (depends on T002): import `rateLimitStore`
      from `../../src/data/rateLimit.store` and add `rateLimitStore.reset([]);` to
      `resetStores()`.
- [X] T009 [P] [US1] Create `tests/rateLimit.test.ts` (depends on T004, T007, T008): unit-level
      tests importing `checkRateLimit` directly from `../src/services/rateLimit.service` (mirroring
      `tests/config.test.ts`'s existing precedent of testing a pure, parameterized function
      directly) — `checkRateLimit("caller-a", false, 3, 1000)` → `allowed: true` and confirm
      `rateLimitStore.get("caller-a")` is still `undefined` afterward (disabled mode touches no
      state); three calls with `checkRateLimit("caller-b", true, 3, 1000, 0)` at `now = 0, 10, 20`
      → `allowed: true` each time, `remaining` decreasing 2, 1, 0; a fourth call at `now = 30` →
      `allowed: false`, `retryAfterSec` equal to `Math.ceil((1000 - 30) / 1000)`; a fifth call at
      `now = 1001` (window elapsed) → `allowed: true` again with a fresh window (FR-003).
      Supertest-level test: `GET /rate-limit` against the real running `app` returns `200` with
      `{ remaining, limit }` matching `config.rateLimitRequests` under the real default
      `RATE_LIMIT_ENABLED=false` config, confirming the controller/route wiring (FR-004).

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md
Scenario 1).

---

## Phase 4: User Story 2 - Simulate Flaky, Reproducible Failures (Priority: P2)

**Goal**: `GET /flaky?failureRate=` fails at approximately the requested rate with a
server-selected status from a configurable pool, reproducibly across runs, and can be disabled
entirely via configuration regardless of the requested rate.

**Independent Test**: Call with `failureRate=0`/`1` for single-outcome-deterministic behavior;
call an invalid rate for `400`; confirm a fixed starting state reproduces an identical outcome
sequence. See quickstart.md Scenario 2.

### Implementation for User Story 2

- [X] T010 [P] [US2] Add `FLAKY_ENABLED: boolean().default(true),` to `envSchema` in
      `src/config/env.schema.ts`, placed after `FAILURE_RATE` (research.md Decision 9 — CLAUDE.md
      requires `/flaky` to be "disableable" independent of the caller-supplied `failureRate`, which
      `FAILURE_RATE` alone cannot express; mirrors the existing `RATE_LIMIT_ENABLED` pattern in the
      same schema).
- [X] T011 [US2] Add `flakyEnabled: boolean` to the `ConfigurationProfile` interface and
      `flakyEnabled: parsed.FLAKY_ENABLED,` to the returned object in `loadConfig` in
      `src/config/index.ts` (depends on T010).
- [X] T012 [P] [US2] Add a `FLAKY_ENABLED=true` entry to `.env.example`, immediately after
      `FAILURE_RATE`, with a comment following the existing style: "Master switch for `GET
      /flaky`'s failure simulation. When false, that endpoint always returns 200 regardless of
      `failureRate`. Boolean (true/false). Default: true." (depends on T010; also add the same
      line, if a local `.env` file exists, so the running dev server picks up the new default).
- [X] T013 [P] [US2] Create `src/utils/seededRandom.ts`: a small `mulberry32(seed: number): () =>
      number` PRNG factory (research.md Decision 5 — standard public-domain 32-bit PRNG
      implementation); a module-level `let next = mulberry32(0x20260912);` (a fixed constant
      seed); export `nextRandom(): number` → `next()`; export `resetSeededRandom(): void` → `next
      = mulberry32(0x20260912);` (reinitializes to the exact same starting state).
- [X] T014 [P] [US2] Create `src/models/flakyRequests.ts`: `parseFailureRateParam(raw: unknown,
      fallback: number): number` — returns `fallback` when `raw === undefined`; otherwise throws
      `HttpError(400, "VALIDATION_ERROR", "failureRate must be a decimal between 0 and 1.")`
      unless `raw` is a string matching `/^(0(\.\d+)?|1(\.0+)?)$/` after trimming (accepts `"0"`,
      `"1"`, `"0.5"`, `"0.5000001"`; rejects negative, greater-than-1, scientific notation, and
      non-numeric values in one shot — FR-006, spec.md Edge Cases); returns `Number(raw.trim())`
      on success.
- [X] T015 [US2] Create `src/services/flaky.service.ts` (depends on T013): export interface
      `FlakyOutcome { failed: boolean; status?: 500 | 502 | 503 | 504 }`; `const FAILURE_STATUSES =
      [500, 502, 503, 504] as const;`; `rollFlakyOutcome(enabled: boolean, failureRate: number,
      draw: () => number = nextRandom): FlakyOutcome` — when `enabled` is `false`, return `{
      failed: false }` immediately without calling `draw()` at all (FR-008 — disabled mode never
      consumes the shared PRNG's sequence, so it can't disturb reproducibility for callers that
      later re-enable it); otherwise call `draw()` once — if the result is `>= failureRate`, return
      `{ failed: false }`; if `< failureRate`, call `draw()` again to pick
      `FAILURE_STATUSES[Math.floor(secondDraw * FAILURE_STATUSES.length)]` and return `{ failed:
      true, status }` (FR-005, FR-007). `draw` is an injectable parameter (defaulting to the real
      shared `nextRandom`) purely so tests can supply a fixed/fake draw function for edge-case
      assertions without depending on the real PRNG's exact sequence.
- [X] T016 [US2] Create `src/controllers/flaky.controller.ts` (depends on T015, T014): `getFlaky
      (req: Request, res: Response): void` — `const failureRate =
      parseFailureRateParam(req.query.failureRate, config.failureRate);` `const outcome =
      rollFlakyOutcome(config.flakyEnabled, failureRate);` when `outcome.failed`,
      `res.status(outcome.status!).json(buildErrorEnvelope("SIMULATED_FAILURE", "Simulated flaky
      failure.", requestIdOf(req)))`; else `res.status(200).json({ ok: true })`.
- [X] T017 [US2] Create `src/routes/flaky.routes.ts` (depends on T016): `export const flakyRouter =
      Router({ strict: true });` mount `GET /flaky` → `flakyController.getFlaky`;
      `flakyRouter.all("/flaky", methodNotAllowedHandler)`.
- [X] T018 [US2] Wire `flakyRouter` into `src/app.ts` (depends on T017): mount it top-level,
      matching CLAUDE.md's `/flaky` path spelling (no `/api/v1` prefix).
- [X] T019 [US2] Extend `tests/helpers/resetStores.ts` (depends on T013): import
      `resetSeededRandom` from `../../src/utils/seededRandom` and call it in `resetStores()`.
- [X] T020 [P] [US2] Create `tests/flaky.test.ts` (depends on T015, T018, T019): unit-level tests
      importing `rollFlakyOutcome` directly — `rollFlakyOutcome(false, 1, () => 0)` → `{ failed:
      false }` (disabled overrides even a would-always-fail rate, FR-008); `rollFlakyOutcome(true,
      0, () => 0.999999)` → `{ failed: false }`; `rollFlakyOutcome(true, 1, () => 0)` → `{ failed:
      true, status: <one of 500/502/503/504> }`; reproducibility — call `resetSeededRandom()`, draw
      five outcomes via `rollFlakyOutcome(true, 0.5)` (real `nextRandom`) into an array, call
      `resetSeededRandom()` again, draw five more into a second array, `expect(arrayA)
      .toEqual(arrayB)` (FR-007, SC-002). Supertest-level tests: `GET /flaky?failureRate=0` →
      `200` `{ ok: true }`; `GET /flaky?failureRate=1` → status one of 500/502/503/504 with the
      standard error envelope; `GET /flaky?failureRate=2`, `?failureRate=-1`, `?failureRate=abc` →
      `400` each.

**Checkpoint**: User Stories 1 and 2 both work independently (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Submit Idempotent Payments (Priority: P3)

**Goal**: `POST /api/v1/payments` requires an `Idempotency-Key`, creates exactly one payment per
new key, replays the original result for an identical retry, and rejects a same-key-different-body
reuse with `409`.

**Independent Test**: Post with a new key (expect `201`), repeat identically (expect `200`, no new
payment), repeat with a different body (expect `409`). See quickstart.md Scenario 3.

### Implementation for User Story 3

- [X] T021 [P] [US3] Create `src/models/idempotencyRecord.ts`: `export interface IdempotencyRecord
      { id: string; requestHash: string; statusCode: 201; payment: Payment; }` (`id` is the raw
      `Idempotency-Key` header value; data-model.md).
- [X] T022 [P] [US3] Create `src/data/idempotency.store.ts`: `import { createKeyedStore } from
      "./keyedStore"; import type { IdempotencyRecord } from "../models/idempotencyRecord"; export
      const idempotencyStore = createKeyedStore<IdempotencyRecord>();` (research.md Decision 3).
- [X] T023 [P] [US3] Create `src/utils/canonicalJson.ts`: `canonicalize(value: unknown): unknown` —
      recursively sorts object keys (arrays map element-wise, primitives pass through unchanged) so
      semantically-identical bodies with different key order produce identical output;
      `hashRequestBody(body: unknown): string` — `createHash("sha256")
      .update(JSON.stringify(canonicalize(body))).digest("hex")` (`node:crypto`, research.md
      Decision 3).
- [X] T024 [P] [US3] Create `src/models/paymentRequests.ts`: `createPaymentRequestSchema = z.object
      ({ orderId: z.number().int().positive(), amount: z.number().nonnegative(), status: z.enum
      (PAYMENT_STATUSES) }).strict();` importing `PAYMENT_STATUSES` from `./enums` (FR-010,
      data-model.md — matches the existing `Payment` model's field types exactly; `.strict()`
      rejects unexpected fields).
- [X] T025 [US3] Extend `src/services/payment.service.ts` (depends on T022, T023, T024, existing
      `paymentStore`): add `createPaymentIdempotently(idempotencyKey: string, body:
      z.infer<typeof createPaymentRequestSchema>): { statusCode: 200 | 201; payment: Payment }` —
      `const requestHash = hashRequestBody(body);` `const existing =
      idempotencyStore.get(idempotencyKey);` if `existing`: when `existing.requestHash ===
      requestHash`, return `{ statusCode: 200, payment: existing.payment }` (FR-012); else throw
      `HttpError(409, "IDEMPOTENCY_KEY_CONFLICT", "This Idempotency-Key was already used with a
      different request body.")` (FR-013, never creating/modifying any payment). Otherwise (no
      existing record): build `const payment: Payment = { id: randomUUID(), orderId: body.orderId,
      amount: body.amount, status: body.status, processedAt: new Date().toISOString().slice(0,
      10), createdAt: new Date().toISOString() };` `paymentStore.create(payment);`
      `idempotencyStore.create({ id: idempotencyKey, requestHash, statusCode: 201, payment });`
      return `{ statusCode: 201, payment }` (FR-011; research.md Decision 4 — this whole
      check-then-write path is synchronous with no `await`, so concurrent same-key requests cannot
      interleave, satisfying FR-014 with no lock).
- [X] T026 [US3] Extend `src/controllers/payment.controller.ts` (depends on T025): add
      `postPayment(req: Request, res: Response): void` — `const idempotencyKey =
      req.header("Idempotency-Key");` throw `HttpError(400, "VALIDATION_ERROR", "Idempotency-Key
      header is required.")` when missing/empty (FR-009); `const body =
      createPaymentRequestSchema.parse(req.body);` (a `ZodError` here is handled by the existing
      global `errorHandler` as `400`, and — critically — happens **before** any idempotency-store
      write, so an invalid body never reserves the key, FR-010); `const { statusCode, payment } =
      paymentService.createPaymentIdempotently(idempotencyKey, body);`
      `res.status(statusCode).json(payment);`.
- [X] T027 [US3] Extend `src/routes/payment.routes.ts` (depends on T026): insert
      `paymentRouter.post("/payments", paymentController.postPayment);` **before** the existing
      `paymentRouter.all("/payments", methodNotAllowedHandler);` line (the catch-all must stay
      last, after every real method is registered on that exact path).
- [X] T028 [US3] Extend `tests/helpers/resetStores.ts` (depends on T022): import
      `idempotencyStore` from `../../src/data/idempotency.store` and add
      `idempotencyStore.reset([]);` to `resetStores()`.
- [X] T029 [P] [US3] Create `tests/paymentsIdempotency.test.ts` (depends on T027, T028): a fresh
      `Idempotency-Key` (`randomUUID()`) with a valid body → `201` and a new payment; the identical
      key+body repeated → `200` with the same payment `id` as the first call, and confirm no second
      payment exists (e.g. via `GET /api/v1/payments/:id` count or store size stays the same); the
      same key with a different body (e.g. different `amount`) → `409` with
      `IDEMPOTENCY_KEY_CONFLICT`; missing `Idempotency-Key` header → `400`; an invalid body (e.g.
      missing `orderId`, or an unexpected extra field) with a valid, unused key → `400`/`422`,
      followed by a retry of the **same** key with a now-valid body → `201` (proving the invalid
      attempt never reserved the key, FR-010); two concurrent requests
      (`Promise.all([request(app).post(...), request(app).post(...)])`) sharing one fresh key and
      identical bodies → exactly one `201` and one `200` (or two responses with the same payment
      `id`), never two distinct payments (FR-014).

**Checkpoint**: User Stories 1, 2, and 3 all work independently (quickstart.md Scenario 3).

---

## Phase 6: User Story 4 - Validate Cached Responses (Priority: P4)

**Goal**: `GET /cache/resource` serves `ETag`/`Last-Modified`/`Cache-Control` and honors
`If-None-Match`/`If-Modified-Since` with `304`; `PUT /cache/resource` updates the content and
reissues both validators.

**Independent Test**: Fetch once, conditionally refetch (expect `304`), update via `PUT`,
conditionally refetch with the stale validator (expect `200` with a new `ETag`). See
quickstart.md Scenario 4.

### Implementation for User Story 4

- [X] T030 [P] [US4] Create `src/models/cacheResource.ts`: `export interface CacheResource {
      content: unknown; version: number; updatedAt: string; }`; `cacheResourceUpdateSchema =
      z.object({ content: z.unknown() }).strict().refine((data) =>
      Object.prototype.hasOwnProperty.call(data, "content"), { message: "content is required",
      path: ["content"] });` (the `.refine` is needed because `z.unknown()` alone accepts a missing
      key as `undefined` and would not otherwise reject an absent `content` field — FR-018,
      data-model.md).
- [X] T031 [P] [US4] Create `src/data/cacheResource.store.ts`: a fixed seed constant (e.g. `const
      SEED_CONTENT = { message: "Hello, cache!" };` `const SEED_UPDATED_AT =
      "2026-01-01T00:00:00.000Z";`); module-level `let resource: CacheResource = { content:
      SEED_CONTENT, version: 1, updatedAt: SEED_UPDATED_AT };`; export `cacheResourceStore` with
      `get(): CacheResource` (returns `resource`), `update(content: unknown): CacheResource` (sets
      `resource = { content, version: resource.version + 1, updatedAt: new Date().toISOString()
      };` and returns it), `reset(): void` (restores `resource` to the fixed seed values) —
      research.md Decision 6 (a singleton, not `createKeyedStore`, since there is exactly one
      resource).
- [X] T032 [US4] Create `src/services/cache.service.ts` (depends on T031): re-export
      `getCacheResource = cacheResourceStore.get` and `updateCacheResource =
      cacheResourceStore.update`; `buildEtag(version: number): string` → `` `"v${version}"` ``;
      `matchesConditional(req: Request, etag: string, lastModified: string): boolean` — reads
      `req.header("If-None-Match")`; if present, return `ifNoneMatch === etag` (final answer,
      ignoring `If-Modified-Since` entirely — research.md Decision 7); else reads
      `req.header("If-Modified-Since")`; if absent, return `false`; else `const since =
      Date.parse(ifModifiedSince); if (Number.isNaN(since)) return false; return since >=
      Date.parse(lastModified);` (a malformed date parses to `NaN` and falls through to `false`,
      i.e. "does not match" → full `200`, never an error — FR-016, FR-017, spec.md Edge Cases).
- [X] T033 [US4] Create `src/controllers/cache.controller.ts` (depends on T032, T030):
      `getCacheResource(req: Request, res: Response): void` — `const resource =
      cacheService.getCacheResource(); const etag = cacheService.buildEtag(resource.version);
      res.set("ETag", etag); res.set("Last-Modified", resource.updatedAt); res.set("Cache-Control",
      "public, max-age=60, must-revalidate"); if (cacheService.matchesConditional(req, etag,
      resource.updatedAt)) { res.status(304).end(); return; } res.status(200).json(resource);`
      (FR-015, FR-016, FR-017). `putCacheResource(req: Request, res: Response): void` — `const {
      content } = cacheResourceUpdateSchema.parse(req.body); const resource =
      cacheService.updateCacheResource(content); const etag =
      cacheService.buildEtag(resource.version); res.set("ETag", etag).set("Last-Modified",
      resource.updatedAt).status(200).json(resource);` (FR-018).
- [X] T034 [US4] Create `src/routes/cache.routes.ts` (depends on T033): `export const cacheRouter =
      Router({ strict: true });` mount `GET /cache/resource` → `cacheController.getCacheResource`
      and `PUT /cache/resource` → `cacheController.putCacheResource`, then
      `cacheRouter.all("/cache/resource", methodNotAllowedHandler)`.
- [X] T035 [US4] Wire `cacheRouter` into `src/app.ts` (depends on T034): mount it top-level,
      matching CLAUDE.md's `/cache/resource` path spelling (no `/api/v1` prefix — research.md
      Decision 8).
- [X] T036 [US4] Extend `tests/helpers/resetStores.ts` (depends on T031): import
      `cacheResourceStore` from `../../src/data/cacheResource.store` and add
      `cacheResourceStore.reset();` to `resetStores()`.
- [X] T037 [P] [US4] Create `tests/cache.test.ts` (depends on T035, T036): `GET /cache/resource`
      with no conditional headers → `200` with `ETag`/`Last-Modified`/`Cache-Control` headers and
      the seeded body; the same `ETag` sent back via `If-None-Match` → `304` with no body; the
      current `Last-Modified` sent back via `If-Modified-Since` (no `If-None-Match`) → `304`; a
      non-matching `If-None-Match` → `200` with the full body; `PUT /cache/resource` with `{
      "content": { "changed": true } }` → `200` with an incremented `version`, a new `ETag`, and a
      new `Last-Modified`; the pre-`PUT` `ETag` resent via `If-None-Match` after the `PUT` → `200`
      (no longer matches, not `304`); both `If-None-Match` (non-matching) and `If-Modified-Since`
      (matching) sent together → the `If-None-Match` result wins (`200`, not `304` —
      research.md Decision 7, spec.md Edge Cases); a malformed `If-Modified-Since` value → `200`
      (never an error); `PUT /cache/resource` with a missing `content` field → `400`.

**Checkpoint**: All four user stories independently functional (quickstart.md Scenario 4).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [X] T038 [P] Merge `contracts/resilience-simulation.openapi.yaml`'s `tags`, `paths`,
      `components.schemas` (`RateLimitStatus`, `FlakyResult`, `CreatePaymentRequest`,
      `CacheResource`, `CacheResourceUpdateRequest`), and `components.responses` (`RateLimited`,
      `Conflict`) into the root `openapi.yaml`, reusing the existing `Error`/`ValidationError`/
      `Payment`/`PaymentStatus` schemas/responses rather than duplicating them, so `/docs`,
      `/openapi.json`, and `/openapi.yaml` document exactly the 5 operations this spec implements
      (constitution: Quality Gates & Spec Parity). No `allOf`/`oneOf`/`anyOf` combinators
      (project memory: OpenAPI spec must avoid combinators).
- [X] T039 Run `npm test` and confirm the full suite — Specs 001-007's existing tests plus
      `tests/rateLimit.test.ts`, `tests/flaky.test.ts`, `tests/paymentsIdempotency.test.ts`, and
      `tests/cache.test.ts` — passes, including confirming the existing `tests/payments.test.ts`
      (read-only scenarios) still passes unchanged after `payment.routes.ts`/`payment.controller
      .ts`/`payment.service.ts` gained their additive `POST` support.
- [X] T040 Execute the manual validation scenarios in
      `specs/008-resilience-simulation/quickstart.md` against a running `npm run dev` server
      (temporarily setting `RATE_LIMIT_ENABLED=true` and a low `RATE_LIMIT_REQUESTS` for Scenario
      1 as the quickstart instructs) and confirm every expected status code, header, and body.
- [X] T041 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 5
      new/changed operations correctly with no schema errors. Note: `GET /api/v1/routes` is not yet
      implemented in this codebase (Spec 012's deliverable per the roadmap) — verified instead
      that `/openapi.json` lists exactly the 4 new top-level paths plus the new `POST` operation on
      the existing `/api/v1/payments` path, and every `$ref` in them resolves.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks — no new dependency needed.
- **Foundational (Phase 2)**: No tasks — no cross-story blocking prerequisite exists.
- **User Stories (Phase 3-6)**: Each depends only on Spec 001 (and, for US3, Spec 003) — all
  already built. All four can start immediately, in any order, in parallel.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on any other story in this spec.
- **User Story 2 (P2)**: No dependency on any other story in this spec.
- **User Story 3 (P3)**: No dependency on any other story in this spec; extends Spec 003's
  existing `payment.*` files.
- **User Story 4 (P4)**: No dependency on any other story in this spec.

### Within Each User Story

- US1: model + store + caller-identity util (parallel) → service → controller → routes → `app.ts`
  wiring → `resetStores.ts` wiring → tests.
- US2: env schema/config/`.env.example` (parallel) + seeded-PRNG util + query-param validator
  (parallel) → service → controller → routes → `app.ts` wiring → `resetStores.ts` wiring → tests.
- US3: model + store + canonical-hash util + request schema (parallel) → extend
  `payment.service.ts` → extend `payment.controller.ts` → extend `payment.routes.ts` →
  `resetStores.ts` wiring → tests.
- US4: model + store (parallel) → service → controller → routes → `app.ts` wiring →
  `resetStores.ts` wiring → tests.

### Parallel Opportunities

- All four user stories (Phases 3-6) can proceed fully in parallel with each other, since none
  shares a file except the two additive, non-conflicting shared files noted above (`src/app.ts`,
  `tests/helpers/resetStores.ts`) — coordinate those two files' edits sequentially (or merge
  carefully) if working in parallel, since each story's edit to them is a small, independent
  addition rather than a structural change.
- Within US1: T001, T002, T003 run in parallel (different files, no cross-dependencies).
- Within US2: T010 and T013/T014 run in parallel (T011/T012 depend on T010; T013/T014 depend on
  nothing in this story).
- Within US3: T021, T022, T023, T024 run in parallel (different files, no cross-dependencies).
- Within US4: T030 and T031 run in parallel (different files, no cross-dependencies).
- T038 and T041 (Polish) run in parallel; T039 and T040 are sequential whole-suite/manual checks
  that should follow T038.

---

## Parallel Example: All Four User Stories

```bash
# Since Phases 3-6 share no blocking prerequisite, all four can start immediately:
Task: "Implement GET /rate-limit end-to-end (User Story 1)"
Task: "Implement GET /flaky end-to-end (User Story 2)"
Task: "Implement POST /api/v1/payments idempotency end-to-end (User Story 3)"
Task: "Implement GET/PUT /cache/resource end-to-end (User Story 4)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (rate limiting, full test coverage) — no Setup/Foundational
   phase blocks it.
2. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
3. Deploy/demo if ready — this alone gives testing tools a working rate-limit endpoint to validate
   backoff/retry logic against.

### Incremental Delivery

1. User Story 1 → test independently → deploy/demo (MVP!).
2. User Story 2 → test independently → deploy/demo.
3. User Story 3 → test independently → deploy/demo.
4. User Story 4 → test independently → deploy/demo.
5. Polish → spec/implementation parity confirmed, full suite green.

Order among Stories 1-4 is arbitrary — pick any sequence, or build all four in parallel.

### Parallel Team Strategy

With multiple developers: Developer A takes US1, Developer B takes US2, Developer C takes US3,
Developer D takes US4 — all four can start simultaneously with no cross-story blocking, only
coordinating the two small shared-file edits (`src/app.ts`, `tests/helpers/resetStores.ts`).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- Both `rateLimit.service.ts::checkRateLimit` and `flaky.service.ts::rollFlakyOutcome` are
  deliberately written as pure functions parameterized by `enabled`/`limit`/`windowMs`/`now` (US1)
  or `enabled`/`failureRate`/`draw` (US2) rather than reading the frozen `config` singleton
  directly — this is what makes their "enabled," threshold, window-rollover, and
  seeded-reproducibility behavior unit-testable without a real 60-second sleep or an
  environment-specific `RATE_LIMIT_ENABLED=true`/`FLAKY_ENABLED=false` override, mirroring
  `tests/config.test.ts`'s existing precedent of testing `loadConfig` as a pure function directly.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies
  that would break a later story's ability to be demoed on its own.
