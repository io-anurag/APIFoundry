# Implementation Plan: Foundation, Config & Health

**Branch**: `001-foundation-platform` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-foundation-platform/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Stand up the running, empty-but-correct Express + TypeScript server every later spec builds on: the
exact module layout from `CLAUDE.md`, environment-driven configuration that fails fast on invalid input,
the shared error envelope and pagination envelope, request-id propagation, structured secret-free
request logging, configurable CORS, health/liveness/readiness/version/`/api/v1/info` endpoints, and a
minimal OpenAPI document + Swagger UI skeleton that later specs extend. Technical approach: `zod`-validated
config, `pino`/`pino-http` structured logging with redaction, native `crypto.randomUUID()` for request
ids, `cors` for CORS, a hand-authored `openapi.yaml` served via `swagger-ui-express`, and Vitest +
Supertest for the test harness (see [research.md](research.md) for rationale on each).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS)

**Primary Dependencies**: Express 4.x, `zod` (env validation), `pino` + `pino-http` (structured logging),
`cors`, `dotenv`, `swagger-ui-express` + `js-yaml` (OpenAPI/Swagger), `tsx` (dev runner), `typescript`

**Storage**: N/A — in-memory only; this spec introduces no persisted resources

**Testing**: Vitest + Supertest

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for
external testing tools (k6, Postman, contract-test suites)

**Project Type**: Single backend web-service (REST API server), no frontend

**Performance Goals**: Health/version/info endpoints respond in low tens of milliseconds under normal
load; no specific throughput target for this spec beyond "adds no measurable overhead" (later specs'
load-testing endpoints carry their own targets)

**Constraints**: No unbounded memory/CPU per request; no external network calls; deterministic responses
for all endpoints in this spec (none are randomness/flaky endpoints); invalid input must never crash the
process; secrets (JWT secret, admin token, etc.) must never appear in logs or responses even though most
are not yet exercised until later specs

**Scale/Scope**: This spec only — project scaffolding, config loader, cross-cutting middleware, and the
five meta endpoints (`/health`, `/health/live`, `/health/ready`, `/version`, `/api/v1/info`); no business
resources, auth, or utility endpoints (those are Specs 002+)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | This spec only adds surface (config, health, meta endpoints) that later specs and testing tools depend on; nothing is removed or narrowed. |
| II. Determinism & Reproducibility | PASS | No randomness anywhere in this spec's scope; health/version/info are pure functions of config + process state. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Central error-handling middleware (catches sync/async throws, malformed JSON body parse errors, unmatched routes/methods) returns the one documented error envelope; pagination envelope is defined even though unused yet. `X-Request-ID` attached to every response via middleware ordered first in the stack. |
| IV. Secret & Credential Hygiene | PASS | `pino` redaction configured for known secret-bearing config keys/headers (`Authorization`, `Cookie`, `jwtSecret`, `adminToken`); `/api/v1/info` payload excludes all secret config fields (see data-model.md `ApiInfo`); `.env` stays gitignored, only `.env.example` tracked. |
| V. Bounded Resource Usage Under Load | PASS | All endpoints in this spec are O(1) reads of in-memory config/process state; no delay/large-payload behavior is introduced here (that's Spec 007). |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Jest-or-Vitest+Supertest) | PASS | Project structure below matches `CLAUDE.md` exactly; Vitest chosen per research.md, satisfies "Jest or Vitest". |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml`/`/docs`/`/openapi.json` must document exactly the 5 endpoints this spec implements — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
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
├── app.ts              # express app wiring: middleware + routes, no listen()
├── server.ts           # entrypoint: loads config, calls app.listen()
├── config/
│   ├── env.schema.ts    # zod schema for process.env
│   └── index.ts          # loads dotenv, validates, exports frozen ConfigurationProfile
├── middleware/
│   ├── requestId.ts       # attaches X-Request-ID (crypto.randomUUID()) to req + res header
│   ├── requestLogger.ts   # pino-http wiring, redaction config
│   ├── cors.ts             # cors() configured from ConfigurationProfile.corsOrigin
│   └── errorHandler.ts    # central error middleware -> ErrorEnvelope; 404/405 handlers
├── routes/
│   ├── health.routes.ts   # /health, /health/live, /health/ready
│   ├── version.routes.ts  # /version
│   └── info.routes.ts     # /api/v1/info (mounted under configured apiPrefix)
├── controllers/
│   ├── health.controller.ts
│   ├── version.controller.ts
│   └── info.controller.ts
├── services/
│   └── health.service.ts  # readiness flag, uptime calculation
├── models/
│   ├── errorEnvelope.ts
│   ├── paginationEnvelope.ts
│   ├── healthStatus.ts
│   ├── versionInfo.ts
│   └── apiInfo.ts
├── utils/
│   └── logger.ts           # shared pino instance
└── openapi/
    └── index.ts             # loads openapi.yaml, mounts swagger-ui-express + /openapi.json + /openapi.yaml

tests/
├── health.test.ts
├── version.test.ts
├── info.test.ts
├── errorEnvelope.test.ts     # 404 / 405 / malformed-body cases
└── config.test.ts             # invalid-config startup failure

openapi.yaml                   # single project-wide OpenAPI document; this spec seeds it
package.json
tsconfig.json
.env.example
README.md
```

**Structure Decision**: Single backend project, no frontend — matches `CLAUDE.md`'s mandated module
split exactly (routes/controllers/services/models/middleware/config/utils/openapi, each owning one
responsibility). This spec creates the full skeleton; later specs add files within it (new
`routes/*.routes.ts`, `controllers/*.controller.ts`, etc.) rather than restructuring it.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS: the data model introduces no
persisted business entities (only shared envelopes/config), the OpenAPI contract documents exactly the
five endpoints implemented (no scope creep), and the quickstart's fail-fast-config and
malformed-body/undefined-route/method-not-allowed scenarios directly exercise Principles II–III. No new
violations introduced during design; Complexity Tracking remains empty.
