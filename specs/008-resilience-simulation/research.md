# Phase 0 Research: Resilience Simulation

All items below were resolvable from CLAUDE.md, the constitution, the existing Spec 001-007
codebase conventions, and the three decisions already recorded in spec.md's Clarifications
session. No `NEEDS CLARIFICATION` markers remain in the Technical Context.

## Decision 1: Rate-limit counters reuse `createKeyedStore<T>()`, keyed by caller identity

**Decision**: `src/data/rateLimit.store.ts` exports `rateLimitStore = createKeyedStore<RateLimitCounter>()`,
where each record's `id` is the resolved caller identity string (`X-API-Key` header value if
present, else `req.ip`). `rateLimit.service.ts`'s `checkRateLimit(callerId)` reads the record, and
if the current time is past `windowStart + RATE_LIMIT_WINDOW_MS`, replaces it with a fresh window
(`count: 1`); otherwise increments `count` and compares against `RATE_LIMIT_REQUESTS`.

**Rationale**: `createKeyedStore` already exists precisely for string-keyed, caller-assigned-id
records (`apiKeyStore` reuses it the same way) — no new store abstraction is needed. Scoping by
`X-API-Key`-or-IP (confirmed in spec.md Assumptions) keeps `GET /rate-limit` itself unauthenticated
while still tracking independent quotas per caller, satisfying the Edge Case that one caller must
never exhaust another's limit.

**Alternatives considered**: a global (non-keyed) single counter shared by all callers (rejected —
directly violates the Edge Case requiring independent per-caller tracking, and would make the
endpoint untestable by two concurrent load-testing clients without interfering with each other); a
new bespoke `Map`-based store (rejected — `createKeyedStore` already provides exactly the needed
`get`/`create`/`replace`/`reset` operations with no adaptation needed).

## Decision 2: `Retry-After` is computed, not fixed

**Decision**: When a caller is over the threshold, `checkRateLimit` also returns
`retryAfterSec = Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000)`, and the
controller sets `res.set("Retry-After", String(retryAfterSec))`.

**Rationale**: FR-002 requires a `Retry-After` header a real client could act on; a fixed value
(as the unrelated `/api/v1/status/429` demo from Spec 004 already uses, per `openapi.yaml` line
1293's "no real rate-limit state is tracked" note) would be inconsistent with this spec's actual
per-caller window tracking and could mislead a test asserting the wait actually clears the limit.

**Alternatives considered**: a fixed `Retry-After: 60` regardless of actual window state
(rejected — this spec's `GET /rate-limit`, unlike the unrelated status-code demo, does track real
per-caller state, so the header should reflect it).

## Decision 3: Idempotency conflict detection via a canonical-JSON SHA-256 hash

**Decision**: `src/data/idempotency.store.ts` exports `idempotencyStore = createKeyedStore<IdempotencyRecord>()`,
keyed by the raw `Idempotency-Key` header value. On `POST /api/v1/payments`, the service computes
`requestHash = sha256(canonicalize(body))` (`canonicalize` recursively sorts object keys before
`JSON.stringify`, so semantically-identical bodies with different key order still match). A new
key stores `{ requestHash, statusCode: 201, payment }`; a key seen before compares `requestHash` —
match → replay the stored `statusCode`/`payment` (`200`); mismatch → `409 IDEMPOTENCY_KEY_CONFLICT`.

**Rationale**: A plain `JSON.stringify(body) === JSON.stringify(previousBody)` string comparison
would treat `{"a":1,"b":2}` and `{"b":2,"a":1}` as a false conflict, which is exactly the kind of
incidental-formatting difference a retrying HTTP client library could introduce (e.g. a different
JSON serializer on retry) without the request being meaningfully different. Hashing the
canonicalized form avoids that false positive while still catching genuinely different bodies.
`createKeyedStore` is reused for the same reason as Decision 1 — it already fits a string-keyed
record with a `reset()` for tests/admin-reset.

**Alternatives considered**: raw string comparison of `JSON.stringify(body)` (rejected per above —
false-positive risk on key reordering); storing the full original body instead of a hash and doing
a deep-equal comparison (rejected — a hash is smaller to store and equally correct once bodies are
canonicalized first; deep-equal would need the same canonicalization step anyway to avoid the same
key-order false positive, so hashing adds no extra complexity while capping stored-record size).

## Decision 4: Concurrent same-key idempotent requests are safe by construction (no lock needed)

**Decision**: No explicit locking/mutex is added around the idempotency check-then-write. The
service performs `get` → (on miss) create-payment → `create` synchronously, with no `await`
between the read and the write.

**Rationale**: Node.js runs application code on a single thread; two requests can only interleave
at an `await` point. Because this feature's entire request path (idempotency lookup, payment
creation via the in-memory store, idempotency record write) is synchronous — no database call, no
file I/O, no network call — one request's check-then-write cannot be interrupted by another's
before it completes. This satisfies FR-014 ("concurrent requests bearing the same new
`Idempotency-Key` never result in more than one payment") with zero added complexity, as long as
future maintenance never introduces an `await` between the read and the write for this path.

**Alternatives considered**: an explicit in-process mutex/lock keyed by `Idempotency-Key`
(rejected — solves a race that cannot occur given the synchronous, single-threaded execution path;
would add unused complexity and a new failure mode, such as a stuck lock, for the sake of a
non-existent problem).

## Decision 5: `/flaky` uses a seeded PRNG (`mulberry32`) with a fixed default seed, reset like any other store

**Decision**: `src/utils/seededRandom.ts` implements `mulberry32(seed)` (a small, well-known,
dependency-free 32-bit PRNG) and exposes a module-level instance seeded with a fixed constant
(e.g. `0x2026_09_12`), plus `resetSeededRandom()` that reinitializes it to that same constant.
`flaky.service.ts`'s `rollFlakyOutcome(failureRate)` draws the next value from this instance
(`0` to `1`) and compares it against `failureRate` to decide pass/fail, then (on fail) draws a
second value to index into the configured failure-status pool.
`tests/helpers/resetStores.ts` calls `resetSeededRandom()` alongside every other store's reset.

**Rationale**: FR-007 requires that "a fixed seed and call sequence yields an identical outcome
sequence on repeated runs" — this is satisfiable with a fixed default seed (no caller/test-supplied
seed parameter) as long as the sequence restarts from the same state every time a fresh test run
begins. Since every test file
already calls `resetStores()` in `beforeEach` (per the existing convention), adding
`resetSeededRandom()` there means each test run — and each fresh server process — starts the PRNG
at the exact same state, so two independent full runs that issue the same sequence of `/flaky`
calls get an identical pass/fail (and failure-status) sequence, satisfying SC-002 without any new
configuration surface.

**Alternatives considered**: Node's built-in `Math.random()` (rejected — not seedable, so
non-reproducible by definition, directly violating constitution Principle II); a caller-supplied
`?seed=` query parameter (rejected — not requested by CLAUDE.md or the spec, and would let a caller
force the "flaky" endpoint into an entirely predictable, always-passing mode, undermining its
purpose as a resilience-testing tool); a dependency like `seedrandom` (rejected — `mulberry32` is
~6 lines and needs no dependency, consistent with this project's pattern of hand-rolling small,
single-purpose utilities, per Spec 007 research.md Decisions 5/6).

## Decision 6: Cache-demo resource is a version-counter-based ETag, not a content hash

**Decision**: `src/data/cacheResource.store.ts` holds a single module-level record
`{ content: unknown, version: number, updatedAt: string }`, seeded with a fixed deterministic
`content` and `version: 1`. Its `ETag` is the literal string `"\"v" + version + "\""`; its
`Last-Modified` is `updatedAt`. `PUT /cache/resource` replaces `content`, increments `version`, and
sets `updatedAt = new Date().toISOString()`.

**Rationale**: A monotonically incrementing version number is trivially O(1) to compute and
compare (string equality), fully deterministic, and requires no hashing dependency or CPU work —
the simplest possible correct `ETag` implementation, consistent with the constitution's
bounded-resource principle. Because the version only ever changes via the feature's own
`PUT /cache/resource` (Clarifications), there is no scenario where content changes without the
version also changing, so the validator is always accurate.

**Alternatives considered**: a content hash (e.g. SHA-1 of `JSON.stringify(content)`) as the
`ETag` (rejected — strictly more computation for no behavioral benefit over a version counter,
since this feature's only mutation path already guarantees version-content correspondence; a hash
would only matter if content could change through some path that forgets to bump a counter, which
cannot happen here since both live in the same store update).

## Decision 7: `If-None-Match` takes precedence over `If-Modified-Since` when both are present

**Decision**: `cache.service.ts`'s `matchesConditional(req, etag, lastModified)` checks
`If-None-Match` first; if that header is present, its match/no-match result is final (ignoring any
`If-Modified-Since` present on the same request). Only when `If-None-Match` is absent does the
function fall back to comparing `If-Modified-Since` against `lastModified`. Any malformed value in
either header is treated as "does not match" (falls through to `200`), never thrown.

**Rationale**: This mirrors RFC 9110 §13.1.1's own precedence rule for exactly this header
combination, which spec.md's Edge Cases already calls for explicitly. Treating a malformed header
as non-matching (rather than erroring) satisfies the same Edge Case's "never erroring" requirement
and keeps the endpoint's failure mode identical to simply not sending the header at all.

**Alternatives considered**: comparing both headers independently and requiring both to match
(rejected — contradicts both RFC precedence and spec.md's explicit Edge Case); throwing `400` on a
malformed conditional header (rejected — spec.md explicitly calls for graceful fallback to `200`,
not an error).

## Decision 8: Route mounting — `/rate-limit`, `/flaky`, `/cache/resource` are top-level; `POST /payments` stays under `/api/v1`

**Decision**: `rateLimitRouter` and `flakyRouter` mount top-level in `src/app.ts`, alongside
`delayRouter`/`payloadRouter`/etc. from Spec 007. `cacheRouter` (`GET`/`PUT /cache/resource`) also
mounts top-level. `POST /payments` is added to the existing `paymentRouter`, which is already
mounted under the versioned `apiRouter` (`/api/v1/payments`).

**Rationale**: CLAUDE.md spells `/rate-limit`, `/flaky`, and `/cache/resource` without an
`/api/v1` prefix, in the same style as Spec 007's HTTP-mechanics utilities — generic
protocol-level testing utilities, not domain resources — while `payments` is explicitly a
`/api/v1`-prefixed domain resource already established in Spec 003. This matches spec.md's
Assumptions section exactly for `/rate-limit` and `/flaky`, and extends the same reasoning to
`/cache/resource` (not itself a domain resource, and not previously assigned a prefix by any
earlier spec).

**Alternatives considered**: mounting all four under `/api/v1` for uniformity (rejected — would
contradict CLAUDE.md's explicit bare-path spelling and Spec 007's established precedent for
identically-shaped generic testing utilities).

## Decision 9: `FLAKY_ENABLED` is a new boolean config flag, mirroring `RATE_LIMIT_ENABLED`

**Decision**: Add `FLAKY_ENABLED: boolean().default(true)` to `src/config/env.schema.ts`, a
matching `flakyEnabled: boolean` field to `ConfigurationProfile`/`loadConfig` in
`src/config/index.ts`, and document it in `.env.example` immediately after `FAILURE_RATE`.
`GET /flaky` checks `config.flakyEnabled` first: when `false`, it returns `200` unconditionally,
never evaluating `failureRate` at all (not even to validate it).

**Rationale**: CLAUDE.md item #21 requires `/flaky` to be "disableable," and spec.md's FR-008 /
User Story 2 Acceptance Scenario 5 requires this to hold "regardless of `failureRate`" — i.e., a
config-level off switch that overrides whatever the caller supplies, not merely a default rate the
caller can override. `FAILURE_RATE` alone cannot express an override-proof disable (it's only
consulted when the caller omits `failureRate`), so a dedicated boolean is needed — exactly the
same shape as the already-existing `RATE_LIMIT_ENABLED` switch for the sibling rate-limit feature
in the very same `.env.example`. (This corrects spec.md's original Assumptions text, which
incorrectly claimed no new environment variable was needed; see spec.md's Assumptions section as
amended.)

**Alternatives considered**: treating "disabled" as `FAILURE_RATE=0` with no other change
(rejected — a caller could still force failures via `?failureRate=1`, contradicting FR-008's
"regardless of `failureRate`"); silently ignoring the `failureRate` query parameter whenever the
default is `0` (rejected — conflates "disabled" with "default is zero," an implicit and surprising
rule compared to an explicit, named flag).
