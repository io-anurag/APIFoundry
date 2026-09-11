# Implementation Plan: Status Code Playground

**Branch**: `004-status-code-playground` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-status-code-playground/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver a single, self-contained endpoint — `GET /api/v1/status/{code}` — that deterministically
reproduces the exact status line, headers, and body semantics for each of the 24 documented HTTP status
codes (200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405, 406, 408, 409, 410, 415, 422, 429, 500,
501, 502, 503, 504), plus strict validation of the `code` path parameter (malformed, out-of-range,
well-formed-but-unsupported). Technical approach: a static 24-entry response catalog
(`src/data/statusCodeDemos.catalog.ts`) keyed by response shape (`success`/`noBody`/`redirect`/`error`), a
new strict-integer path-parameter validator (`src/utils/statusCodeParam.ts`) that resolves both open
Clarifications questions (leading-zero/whitespace rejection, the 100-599 huge-vs-unsupported boundary) via
one regex plus one range check, and a thin controller that maps each catalog shape to the corresponding
Express response call. No new store, no new dependency, no new environment variable (see
[research.md](research.md) for full rationale).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-003

**Primary Dependencies**: Express 4.x only — no new dependency; this feature needs no request-body
validation (`zod`), so it doesn't even touch that existing dependency

**Storage**: N/A — no in-memory store; the 24 response definitions are static, hand-authored data with no
create/update/delete lifecycle

**Testing**: Vitest + Supertest — unchanged from Specs 001-003

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for external
testing tools (k6, Postman, contract-test suites) — this endpoint is one of the simplest, most
frequently-asserted-against smoke-test targets such tools use

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged from Specs 001-003

**Performance Goals**: Every response is a single static-catalog lookup plus one JSON serialization (or no
body at all for 204/304) — sub-millisecond handler work, no I/O, well within the constitution's
bounded-resource principle even under sustained load-test traffic

**Constraints**: No unbounded memory/CPU per request; no external network calls; fully deterministic
behavior (constitution Principle II, NON-NEGOTIABLE) — repeated requests for the same `code` return
identical status/headers/body aside from `X-Request-ID`; the `code` path parameter validated strictly
before any catalog lookup, per the Clarifications session's leading-zero/whitespace and
huge-vs-unsupported decisions

**Scale/Scope**: This spec only — one route, one path-parameter validator, one static catalog; no
authentication, no real rate-limit or cache-negotiation state (those arrive with Spec 008), and no
dependency on Specs 002/003's resources

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds a dedicated, on-demand way to reproduce every documented status code — pure surface expansion for testing tools, nothing narrowed. |
| II. Determinism & Reproducibility | PASS | Every response is derived from a static catalog with no randomness and no mutable state; identical requests against a fresh or long-running server always return identical status/headers/body (aside from `X-Request-ID`). |
| III. Fail-Safe Handling & Consistent Contracts | PASS | The `code` path parameter is validated by a dedicated parse-or-throw utility (`statusCodeParam.ts`) before any catalog lookup, following the existing `idParam.ts`/`ratingParam.ts` pattern; every error-shaped response reuses the existing `ErrorEnvelope`/`X-Request-ID` middleware unchanged. |
| IV. Secret & Credential Hygiene | PASS | This spec introduces no secrets, tokens, or credentials — the 401/403 demonstrations reference no real credential (FR-009). |
| V. Bounded Resource Usage Under Load | PASS | Every operation is an O(1) static-array lookup plus a small JSON serialization; no external calls, no unbounded allocation, no artificial delay (FR-015) — well-suited to being hit repeatedly during load tests. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New files follow the existing `routes/controllers/services/data/utils` split; the new route mounts under the existing `config.apiPrefix`-scoped router alongside Specs 002/003's routers. |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly the path/schemas in `contracts/status-code-playground.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-status-code-playground/
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
├── app.ts                              # existing; gains one new router mounted on apiRouter
├── data/
│   └── statusCodeDemos.catalog.ts      # NEW: 24-entry static catalog (code, name, message, shape, errorCode?, extraHeaders?)
├── models/
│   └── statusCodeDemo.ts               # NEW: StatusCodeDemo type + the "shape" union + DOCUMENTED_STATUS_CODES set
├── services/
│   └── statusCode.service.ts           # NEW: getStatusCodeDemo(code) — catalog lookup only, no other logic
├── controllers/
│   └── statusCode.controller.ts        # NEW: demonstrateStatusCode(req, res) — maps a catalog entry's shape to the matching Express response call
├── routes/
│   └── statusCode.routes.ts            # NEW: GET /api/v1/status/:code (+ methodNotAllowedHandler for other methods on the same path)
└── utils/
    └── statusCodeParam.ts              # NEW: strict positive-integer parse-or-400, plus the 100-599 range check (FR-010/FR-011/FR-012)

tests/
└── statusCodes.test.ts                 # NEW: all 24 codes' status/headers/body, malformed/huge/unsupported code matrix, determinism

openapi.yaml                            # existing; gains the path/schemas from contracts/status-code-playground.openapi.yaml
```

**Structure Decision**: Extends the existing Specs 001-003 single-backend-project layout — no new
top-level directories, and no changes to any existing resource's files (this feature has no dependency on
Specs 002/003 and touches none of their code). A dedicated `data/services/controllers/routes/utils` file
per layer keeps this feature isolated and easy to remove or extend independently, matching the "one
concern per file" convention already established (e.g. `search.*` in Spec 003 for another
no-single-backing-resource endpoint).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS: `data-model.md` introduces no store, no
secrets, and no external calls, and fixes the exact validation boundary (100-599) and rejection rule
(leading zero / whitespace) the Clarifications session left open, so `code` handling is fully deterministic
and testable per Principle II. `contracts/status-code-playground.openapi.yaml` documents exactly the one
operation and 24+1 response entries this spec implements, reusing the root document's `Error` schema
rather than duplicating it. The quickstart's full-matrix (every documented code), malformed/huge/unsupported
edge-case, and determinism-diff scenarios directly exercise Principles II, III, and V. No new violations
introduced during design; Complexity Tracking remains empty.
