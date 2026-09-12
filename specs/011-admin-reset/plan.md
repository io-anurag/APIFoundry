# Implementation Plan: Admin & Reset

**Branch**: `011-admin-reset` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-admin-reset/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver two admin-token-gated endpoints — `POST /admin/reset` (data-plane) and
`POST /admin/auth/reset` (auth-plane) — that restore every stateful subsystem introduced by Specs
002, 003, 005, 006, and 008/009 to its deterministic seed state, without a server restart. Technical
approach: every store this feature touches (`users`/`products`/`orders`/`customers`/`categories`/
`posts`/`comments`/`reviews`/`payments` seed functions, `fileStore`, `cacheResourceStore`,
`rateLimitStore`, `idempotencyStore`, the shared seeded PRNG, `sessionStore`, `apiKeyStore`) already
exposes exactly the reset primitive this feature needs — `tests/helpers/resetStores.ts` already
calls every one of them for test isolation. This feature does not invent a new reset mechanism; it
splits that existing call sequence into two named, reusable service functions
(`resetDataStores()` / `resetAuthStores()`) in a new `src/services/admin.service.ts`, exposes each
behind its own gated route, and refactors the test helper to call the same two functions instead of
duplicating the sequence — so production code and test code share one source of truth and cannot
drift apart. Admin-credential gating is a new, small `adminAuth` middleware (a single header/value
comparison against `config.adminToken`), modeled directly on the existing `apiKeyAuth` middleware's
401-then-403 shape. See [research.md](research.md) for full rationale on every non-obvious decision.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-010

**Primary Dependencies**: Express 4.x only — no new npm dependency. This feature's own validation
surface is trivial (one header presence/equality check), so it does not need `zod`.

**Storage**: In-memory only, consistent with the whole project. This feature adds **no** new store;
it only calls `.reset(...)` on nine existing stores/seed functions plus the shared seeded PRNG's
`resetSeededRandom()`, exactly as `tests/helpers/resetStores.ts` already does today.

**Testing**: Vitest + Supertest — unchanged from Specs 001-010.

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a direct
target for k6/Postman/contract-test tooling — this spec is what lets a chained k6 workflow (CLAUDE.md
"k6 / workflow orientation") reset the server to a known state between scenarios without restarting
the process.

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged.

**Performance Goals**: Both endpoints' own work is O(n) in the size of the fixed seed data
(re-populating each store's Map from its seed array) — the same cost `tests/helpers/resetStores.ts`
already pays once per test file today — with no external call and no unbounded allocation.

**Constraints**: `POST /admin/reset` MUST NOT touch auth-domain state (`sessionStore`,
`apiKeyStore`) and `POST /admin/auth/reset` MUST NOT touch data-domain state (every seeded resource,
`rateLimitStore`, `idempotencyStore`, `cacheResourceStore`, `fileStore`, the shared seeded PRNG) —
enforced structurally by `resetDataStores()`/`resetAuthStores()` each calling only its own domain's
stores, never the other's. The admin credential comparison follows this codebase's existing
simplicity level (a direct string equality against `config.adminToken`, mirroring how
`config.jwtSecret` and `X-API-Key` lookups are already compared elsewhere) — no timing-safe
comparison is introduced, since none exists anywhere else in this project's auth code either.

**Scale/Scope**: This spec only — 2 new top-level routes, 1 new middleware, 1 new service module, 1
new controller, sharing every store this feature touches with the 9 specs that already established
them. Depends on Specs 002, 003, 005, 006, 008, and 009 per the roadmap (each subsystem this feature
resets must already exist); does not depend on, and is not depended on by, Specs 004, 007, or 010,
none of which hold state that survives a single request (spec.md Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds the one remaining endpoint family CLAUDE.md calls for (#27 admin/reset) — the capability every other spec's own acceptance criteria assumes exists for repeatable automated test runs; nothing narrowed. |
| II. Determinism & Reproducibility | PASS | Both endpoints exist specifically to restore determinism between test runs. Neither endpoint itself introduces any randomness; `resetSeededRandom()` (reset by `POST /admin/reset`) is the mechanism that keeps Spec 008/010's probabilistic behaviors reproducible in the first place. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every rejection path (missing/incorrect admin credential) resolves to a structured `401`/`403` via the existing `HttpError`/`errorHandler` machinery; nothing throws unhandled, and a malformed header value is treated as simply not matching (spec.md Edge Cases) rather than a crash. Both success bodies and every error body use the existing envelopes; every response carries `X-Request-ID`. |
| IV. Secret & Credential Hygiene | PASS | `ADMIN_TOKEN` is already sourced from environment configuration (Spec 001) and already redacted by the existing logger scrub-list (`src/utils/logger.ts`: `*.adminToken`, `config.adminToken`) and by `info.controller`'s config serialization test. This feature adds no new secret and never echoes the presented credential back in any response. |
| V. Bounded Resource Usage Under Load | PASS | Both endpoints' own work is a fixed, bounded re-population of already-bounded-size seed arrays (the same sizes Spec 002/003 already seed) — no unbounded allocation, no external call, no caller-controlled size. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New code follows the existing `routes/controllers/services/middleware` split. Both endpoints mount top-level (mirroring `/auth/*`, `/api-key/*`, `/errors/*`), consistent with every other cross-cutting operational endpoint that isn't a `/api/v1` resource. |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly 2 new paths (`/admin/reset`, `/admin/auth/reset`) from `contracts/admin-reset.openapi.yaml`, one new security scheme (`adminTokenAuth`), and one new schema (`AdminResetResult`) — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/011-admin-reset/
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
├── middleware/
│   └── adminAuth.ts               # NEW: enforces X-Admin-Token against config.adminToken; 401 if
│                                   #   missing/empty, 403 if present but mismatched (mirrors
│                                   #   apiKeyAuth.ts's 401-reason-then-lookup shape, minus the store
│                                   #   lookup — this is a single shared-secret comparison)
├── services/
│   └── admin.service.ts           # NEW: resetDataStores() and resetAuthStores(), each a named,
│                                   #   reusable extraction of half of resetStores()'s existing
│                                   #   sequence (see research.md Decision 1)
├── controllers/
│   └── admin.controller.ts        # NEW: postAdminReset, postAdminAuthReset — each calls its
│                                   #   service function then responds 200 with
│                                   #   { message, domain, requestId }
└── routes/
    └── admin.routes.ts            # NEW: top-level router; POST /admin/reset and
                                    #   POST /admin/auth/reset, each gated by adminAuth; router.all(...)
                                    #   + methodNotAllowedHandler on both paths per the project's
                                    #   established pattern

tests/
├── admin.test.ts                  # NEW: covers both endpoints' success paths, the 401/403 gating
│                                   #   from User Story 3, and the domain-isolation assertions from
│                                   #   User Stories 1-2's acceptance scenarios
└── helpers/resetStores.ts         # CHANGED: body replaced by `resetDataStores(); resetAuthStores();`
                                    #   — same net effect, now sourced from the one place this
                                    #   feature's own reset logic lives, so the two can never drift

openapi.yaml                       # existing; gains the 2 paths/1 scheme/1 schema from
                                   # contracts/admin-reset.openapi.yaml
```

**Structure Decision**: Extends the existing Specs 001-010 single-backend-project layout with no new
top-level directory. One prior-spec file (`tests/helpers/resetStores.ts`) is refactored to delegate
to this feature's new service functions instead of duplicating their sequence — a behavior-preserving
change (every test that currently calls `resetStores()` keeps working identically) that exists
specifically so this feature's split (data vs. auth) becomes the single source of truth for "what a
full reset means," rather than that knowledge living in two places that could silently diverge as
future specs add new stores.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS. `data-model.md` confirms
`resetDataStores()`/`resetAuthStores()` each call only stores belonging to their own domain — the
two functions share no store between them, so FR-008/FR-011 (domain isolation) are structurally
guaranteed rather than merely tested. `contracts/admin-reset.openapi.yaml` documents exactly the 2
operations this spec implements, reuses the root document's existing `Unauthorized`/`Forbidden`
response components rather than redefining them, and adds only the one genuinely new schema
(`AdminResetResult`) and one new security scheme (`adminTokenAuth`) this spec needs. No
`allOf`/`oneOf`/`anyOf` combinators are used anywhere in the contract, consistent with every prior
spec's OpenAPI fragment (and with the project's saved convention against them). The quickstart's
walkthrough directly exercises Principles II and III (mutate every domain, reset one, confirm the
other is untouched; reject a bad credential and confirm no side effect). No new violations
introduced during design; Complexity Tracking remains empty.
