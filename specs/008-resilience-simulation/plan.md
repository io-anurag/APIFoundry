# Implementation Plan: Resilience Simulation

**Branch**: `008-resilience-simulation` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-resilience-simulation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver four resilience-simulation behaviors: a self-contained rate-limit demo
(`GET /rate-limit`, top-level, fixed-window per-caller counter, `429` + `Retry-After` past
threshold), a reproducible flaky-failure demo (`GET /flaky?failureRate=`, top-level, seeded RNG),
idempotent payment creation (`POST /api/v1/payments`, honoring `Idempotency-Key`, reusing Spec
003's `payments` domain), and a conditional-caching demo (`GET`/`PUT /cache/resource`, top-level,
`ETag`/`Last-Modified`/`If-None-Match`/`If-Modified-Since`). Technical approach: reuse the existing
`createKeyedStore<T>()` string-keyed store for both the rate-limit counters and the idempotency
records (each keyed by its own natural string id — caller identity, `Idempotency-Key` — exactly as
`apiKeyStore` already reuses it for API keys); a small dedicated module-level singleton (not a
collection) for the single cache-demo resource; a minimal seeded PRNG (`mulberry32`) for
`/flaky`, reset to its fixed initial seed by the same `reset()` convention every other store
already follows, so a fresh process or an explicit reset reproduces an identical outcome sequence
with no new environment variable. All new state exposes a `reset()` that `tests/helpers/
resetStores.ts` calls today and the future admin-reset endpoint (Spec 011) will call once it
exists (FR-022). See [research.md](research.md) for full rationale on every non-obvious decision.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-007

**Primary Dependencies**: Express 4.x, `zod` (request validation) — no new npm dependency.
`Idempotency-Key` body-conflict detection uses Node's built-in `node:crypto`
(`createHash("sha256")`), already used indirectly elsewhere in the codebase (`randomUUID`); the
seeded PRNG for `/flaky` is a ~10-line hand-rolled `mulberry32` function, not a library
(research.md Decision 4). One new env var, `FLAKY_ENABLED` (boolean, default `true`), is added to
`env.schema.ts`/`config`/`.env.example`, mirroring the existing `RATE_LIMIT_ENABLED` switch
(research.md Decision 9).

**Storage**: In-memory only, consistent with the whole project. Two new `createKeyedStore<T>()`
instances (rate-limit counters, idempotency records) and one new singleton module (the cache demo
resource) — no database, no external cache.

**Testing**: Vitest + Supertest — unchanged from Specs 001-007.

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for
external testing tools (k6, Postman, contract-test suites) — rate-limiting and flaky-failure
behavior are exactly the resilience patterns those tools most commonly need to validate against.

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged.

**Performance Goals**: Every endpoint's own work (counter increment/compare, PRNG draw, hash
comparison, ETag string compare) is O(1) — no unbounded memory allocation, no external network
call, no expensive computation, per the constitution's bounded-resource principle. This spec adds
no endpoint whose "work" scales with any caller-supplied size.

**Constraints**: Rate-limit and idempotency state must be per-caller/per-key, never shared across
callers; idempotency conflict detection must distinguish an identical retry from a conflicting
reuse without false positives from incidental JSON formatting differences (research.md Decision
3); the flaky endpoint's failure/success sequence must be reproducible given the same starting
state (constitution Principle II, FR-007); no endpoint may perform its bounded, intentional
failure/latency behavior in a way that risks the server process itself (e.g., a real crash).

**Scale/Scope**: This spec only — 5 endpoints across 4 resilience areas; depends on Spec 001's
foundation (config, error envelope, request-id middleware) directly, and on Spec 003's `payments`
domain (model, seed store) for the idempotent-write endpoint specifically. Independently
buildable/testable in parallel with Spec 007 and Spec 009 per the roadmap. One shared file is
touched: `tests/helpers/resetStores.ts` gains three new `reset()` calls (additive only — no
existing call is changed).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds four independently-testable resilience behaviors (rate limiting, flaky failures, idempotency, caching) — CLAUDE.md items #20-23 — pure surface expansion; nothing narrowed. |
| II. Determinism & Reproducibility | PASS | Rate-limit windows and idempotency records are deterministic functions of caller input and elapsed time; `/flaky` is the one endpoint whose whole purpose is randomness, and it is made reproducible via a seeded PRNG reset to a fixed initial state by the same convention every other store already follows (research.md Decision 4). |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every failure path (`429` rate-limit, `400` invalid `failureRate`, `400`/`409` idempotency, malformed conditional headers) resolves to a structured response via the existing `HttpError`/`ErrorEnvelope`/`X-Request-ID` machinery; malformed conditional headers degrade to a full `200` rather than erroring (spec.md Edge Cases), never crashing the process. |
| IV. Secret & Credential Hygiene | PASS | No new secret-bearing configuration or header is introduced; `Idempotency-Key` values are caller-supplied opaque strings, not credentials, and are never logged beyond the existing request-id-scoped structured logger. |
| V. Bounded Resource Usage Under Load | PASS | Every new endpoint's own work is O(1) (counter compare, PRNG draw, hash compare, string compare) — no unbounded memory allocation, no external call, no expensive computation; the rate-limit and idempotency stores grow with the number of distinct callers/keys, exactly like every other in-memory store in this project, and are reset the same way. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New code follows the existing `routes/controllers/services/models/data/utils` split; `POST /api/v1/payments` extends the existing `paymentRouter`/`payment.controller.ts`/`payment.service.ts` files rather than duplicating them; `/rate-limit`, `/flaky`, and `/cache/resource` mount top-level, matching CLAUDE.md's literal path spelling exactly as Spec 007's utilities did. |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly the 5 paths/operations (2 new on `/payments`'s existing path plus 4 new top-level paths) in `contracts/resilience-simulation.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-resilience-simulation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── data/
│   ├── rateLimit.store.ts        # NEW: createKeyedStore<RateLimitCounter>(), keyed by caller identity
│   ├── idempotency.store.ts      # NEW: createKeyedStore<IdempotencyRecord>(), keyed by Idempotency-Key
│   └── cacheResource.store.ts    # NEW: singleton {content, version, updatedAt} + get/update/reset
├── utils/
│   ├── seededRandom.ts           # NEW: mulberry32-based PRNG with a fixed default seed + reset()
│   └── callerIdentity.ts         # NEW: resolveCallerIdentity(req) -> X-API-Key or req.ip
├── services/
│   ├── rateLimit.service.ts      # NEW: checkRateLimit(callerId) -> {allowed, remaining, retryAfterSec}
│   ├── flaky.service.ts          # NEW: rollFlakyOutcome(failureRate) -> {failed, status?}
│   ├── payment.service.ts        # existing; gains createPaymentIdempotently(key, body)
│   └── cache.service.ts          # NEW: getCacheResource(), updateCacheResource(content), matchesConditional(req, etag, lastModified)
├── controllers/
│   ├── rateLimit.controller.ts   # NEW: getRateLimit
│   ├── flaky.controller.ts       # NEW: getFlaky
│   ├── payment.controller.ts     # existing; gains postPayment
│   └── cache.controller.ts       # NEW: getCacheResource, putCacheResource
├── models/
│   ├── rateLimitCounter.ts       # NEW: RateLimitCounter interface
│   ├── idempotencyRecord.ts      # NEW: IdempotencyRecord interface
│   ├── flakyRequests.ts          # NEW: flakyQuerySchema (zod)
│   ├── paymentRequests.ts        # NEW: createPaymentRequestSchema (zod)
│   └── cacheResource.ts          # NEW: CacheResource interface + cacheResourceUpdateSchema (zod)
└── routes/
    ├── rateLimit.routes.ts        # NEW: GET /rate-limit
    ├── flaky.routes.ts            # NEW: GET /flaky
    ├── payment.routes.ts          # existing; gains POST /payments
    └── cache.routes.ts            # NEW: GET /cache/resource, PUT /cache/resource

tests/
├── rateLimit.test.ts              # NEW
├── flaky.test.ts                  # NEW
├── paymentsIdempotency.test.ts    # NEW (payments.test.ts stays read-only-focused)
├── cache.test.ts                  # NEW
└── helpers/resetStores.ts         # existing; gains 3 new reset() calls

openapi.yaml                       # existing; gains the paths/schemas from contracts/resilience-simulation.openapi.yaml
```

**Structure Decision**: Extends the existing Specs 001-007 single-backend-project layout with no
new top-level directory — every new file follows the established one-concern-per-layer convention
(`routes/controllers/services/models/data/utils`). `payment.routes.ts`/`payment.controller.ts`/
`payment.service.ts` are the only Spec 003 files touched, and only additively (a new `POST`
handler alongside the existing read-only ones); no other prior spec's resource file is modified,
preserving the roadmap's parallelizability with Spec 007/009.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS. `data-model.md` confirms every
new store follows the project's existing `reset()`-per-store convention, so Spec 011's future
admin-reset endpoint needs only to call three more functions, not design a new mechanism.
`contracts/resilience-simulation.openapi.yaml` documents exactly the 5 operations this spec
implements (reusing the root document's `Error`, `ValidationError`, and `Payment` schemas, and
adding two new reusable responses — `RateLimited` (429) and `Conflict` (409) — for future specs to
reuse rather than duplicate). No `allOf`/`oneOf`/`anyOf` combinators are used anywhere in the
contract, consistent with every prior spec's OpenAPI fragment. The quickstart's rate-limit, flaky,
idempotency, and caching walkthroughs directly exercise Principles II, III, and V (the flaky
sequence is shown to reproduce after a reset; no endpoint's own work scales with caller input). No
new violations introduced during design; Complexity Tracking remains empty.
