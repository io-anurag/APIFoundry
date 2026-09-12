# Implementation Plan: HTTP Testing Utilities

**Branch**: `007-http-testing-utilities` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-http-testing-utilities/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver six low-level HTTP-mechanics testing utilities, all mounted top-level (no `/api/v1`
prefix): configurable response delay (`GET /delay/{ms}` / `GET /delay?ms=`), bounded response
payload generation (`GET /payload/{small|medium|large}` / `GET /payload?size=`), request payload
echo (`POST /payload`), content-type demonstration with request validation
(`GET`/`POST /content/{json|text|html|xml}`), safe header echo (`GET /headers`), and multi-cookie
management (`GET`/`POST`/`DELETE /cookies`). Technical approach: reuse `MAX_DELAY_MS` and
`MAX_PAYLOAD_SIZE` from existing config (no new env vars); wire `MAX_PAYLOAD_SIZE` into the
global `express.json()` limit for the first time (previously unwired) and capture the exact raw
request-body byte length via body-parser's `verify` hook; map body-parser's `PayloadTooLargeError`
to the standard error envelope as a new `413` branch in the shared error handler; use plain
`setTimeout`-based (non-async) delay to avoid Express 4's lack of automatic promise-rejection
handling; hand-roll a small Cookie-header parser (no new dependency, mirroring Spec 006's Basic
Auth header parser) since `res.cookie()`/`res.clearCookie()` are already built into Express. See
[research.md](research.md) for full rationale on every non-obvious decision.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-006

**Primary Dependencies**: Express 4.x, `zod` (request validation) — plus one new dependency,
`bytes` (+ `@types/bytes`), to convert `MAX_PAYLOAD_SIZE`'s string form (e.g. `"10mb"`) into a
byte count for the `GET /payload?size=` bound check; `bytes` is already an indirect dependency of
`body-parser`/Express itself, so this adds no new transitive footprint, only an explicit, pinned
direct dependency (research.md Decision 1).

**Storage**: N/A — every endpoint in this feature is stateless per request; cookies are held by
the client only, never server-side (spec.md Assumptions).

**Testing**: Vitest + Supertest — unchanged from Specs 001-006.

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for
external testing tools (k6, Postman, contract-test suites) — the delay and payload-size utilities
in particular are this project's primary hooks for performance/load-testing scenarios.

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged.

**Performance Goals**: Every endpoint's own work (param validation, byte-exact payload generation,
header filtering, cookie header parse/serialize) is O(1) or O(size-requested) — bounded by the
same configured maximum a caller could ever request, never externally or unboundedly. The delay
endpoint's only "work" is a single `setTimeout` timer per request — no busy-waiting, no blocked
event-loop time.

**Constraints**: No unbounded memory allocation (every generated/accepted payload is bounded by
`MAX_PAYLOAD_SIZE`; every delay is bounded by `MAX_DELAY_MS`); no external network calls; fully
deterministic given the same inputs (aside from the delay endpoint's own deliberate, bounded
wait, which is itself the feature being tested); secrets (`Authorization`, `Cookie`, `X-API-Key`
header values) never echoed by `GET /headers` (constitution Principle IV, FR-013).

**Scale/Scope**: This spec only — 11 endpoints across 6 utility areas; depends only on Spec 001's
foundation (config, error envelope, request-id middleware, logging) and is independently
buildable/testable in parallel with Specs 002-006 per the roadmap. Two shared, cross-cutting
files are touched: `src/app.ts` (body-parser limit + raw-body capture wiring) and
`src/middleware/errorHandler.ts` (new `413` branch) — both additive, no existing behavior changed
for any other spec's endpoints except that request bodies are now actually bounded by
`MAX_PAYLOAD_SIZE` everywhere (previously unenforced anywhere in the app; research.md Decision 1).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds six independently-testable, low-level HTTP-mechanics utilities (delay, payload size, payload echo, content types, headers, cookies) — pure surface expansion; nothing narrowed. |
| II. Determinism & Reproducibility | PASS | Every endpoint's outcome is fully determined by its input and configuration; the delay endpoint's wait is itself the deterministic, bounded, caller-requested behavior under test, not incidental randomness — no `Date.now()`-seeded or random behavior anywhere in this feature. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every failure path (invalid delay/size/preset/type/cookie-name, malformed JSON, oversized body, mismatched Content-Type) resolves to a structured `400`/`413`/`415` via the existing `HttpError`/`ErrorEnvelope`/`X-Request-ID` machinery; the new `413` branch reuses the exact same envelope shape as every other error. |
| IV. Secret & Credential Hygiene | PASS | `GET /headers` explicitly excludes `Authorization`, `Cookie`, and `X-API-Key` values from its echoed body (FR-013); no new secret-bearing configuration is introduced. |
| V. Bounded Resource Usage Under Load | PASS | Delay is bounded by `MAX_DELAY_MS`; generated and accepted payloads are bounded by `MAX_PAYLOAD_SIZE` (now actually enforced at the body-parser level for the first time, closing a pre-existing gap); no endpoint performs an external call or unbounded computation. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New code follows the existing `routes/controllers/services/models/data/middleware/utils` split; every new endpoint is mounted top-level, matching CLAUDE.md's literal path spelling exactly as Specs 005/006 did for `/auth/*`, `/api-key/*`, `/auth-test/*`. |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly the 11 paths/operations in `contracts/http-testing-utilities.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/007-http-testing-utilities/
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
├── app.ts                            # existing; express.json() gains {limit, verify} options + 6 new top-level routers
├── middleware/
│   ├── errorHandler.ts               # existing; gains a PayloadTooLargeError -> 413 branch (mirrors isJsonParseError)
│   └── rawBody.ts                    # NEW: captureRawBody verify-callback + Request.rawBody augmentation
├── models/
│   └── cookieRequests.ts             # NEW: cookieSetRequestSchema (zod)
├── data/
│   ├── payloadPresets.catalog.ts     # NEW: PAYLOAD_SIZE_PRESET_BYTES map (small/medium/large -> byte counts)
│   └── contentTypeDemos.catalog.ts   # NEW: per-type {mediaType, buildBody} catalog for json/text/html/xml
├── utils/
│   ├── delayMsParam.ts               # NEW: parseDelayMsParam(raw, maxMs) -> number, 400 on invalid/out-of-range
│   ├── payloadSizeParam.ts           # NEW: parsePayloadSizeParam(raw, maxBytes) -> number
│   ├── payloadPresetParam.ts         # NEW: parsePayloadPresetParam(raw) -> "small"|"medium"|"large"
│   ├── contentTypeParam.ts           # NEW: parseContentTypeParam(raw) -> "json"|"text"|"html"|"xml"
│   └── cookieHeader.ts               # NEW: parseCookieHeader(header) -> Record<string,string>, never throws
├── services/
│   ├── delay.service.ts              # NEW: resolveDelayMs(req) -> number (path-or-query, validated)
│   ├── payload.service.ts            # NEW: generatePayload(bytes), resolvePayloadSize(req), echoPayload(req)
│   ├── content.service.ts            # NEW: getContentDemo(type), validateContentType(req, type)
│   ├── headers.service.ts            # NEW: getSafeHeaders(req) -> Record<string, string|string[]>
│   └── cookies.service.ts            # NEW: listCookies(req), buildCookieSetSchema-backed logic
├── controllers/
│   ├── delay.controller.ts           # NEW: getDelay (setTimeout-based, no async/await)
│   ├── payload.controller.ts         # NEW: getPayload, postPayload
│   ├── content.controller.ts         # NEW: getContent, postContent
│   ├── headers.controller.ts         # NEW: getHeaders
│   └── cookies.controller.ts         # NEW: getCookies, postCookies, deleteCookies
└── routes/
    ├── delay.routes.ts               # NEW: GET /delay/:ms, GET /delay
    ├── payload.routes.ts             # NEW: GET /payload/:preset, GET /payload, POST /payload
    ├── content.routes.ts             # NEW: GET /content/:type, POST /content/:type
    ├── headers.routes.ts             # NEW: GET /headers
    └── cookies.routes.ts             # NEW: GET/POST/DELETE /cookies

tests/
├── delay.test.ts                     # NEW
├── payload.test.ts                   # NEW
├── content.test.ts                   # NEW
├── headers.test.ts                   # NEW
└── cookies.test.ts                   # NEW

package.json                          # gains bytes + @types/bytes
openapi.yaml                          # existing; gains the paths/schemas from contracts/http-testing-utilities.openapi.yaml
```

**Structure Decision**: Extends the existing Specs 001-006 single-backend-project layout with no
new top-level directory — every new file follows the established one-concern-per-layer convention
(`routes/controllers/services/models/data/middleware/utils`). The only shared files touched are
`src/app.ts` (body-parser options + route mounting) and `src/middleware/errorHandler.ts` (one new
error-mapping branch); no Spec 002-006 resource/feature file is modified, preserving the
roadmap's parallelizability.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS. `data-model.md` introduces no
new mutable server-side state at all (every entity is either a fixed catalog or purely
request-scoped), the strictest determinism posture of any spec so far. `contracts/
http-testing-utilities.openapi.yaml` documents exactly the 11 operations this spec implements,
reusing the root document's `Error` schema and `ValidationError`/`Unauthorized` (n/a here) style
of reusable responses, adding one new reusable `PayloadTooLarge` (413) response for other future
specs to reuse rather than duplicating. No `allOf`/`oneOf`/`anyOf` combinators are used anywhere
in the contract, consistent with every prior spec's OpenAPI fragment. The quickstart's delay,
payload-size, payload-echo, content-type, header, and cookie walkthroughs directly exercise
Principles II, III, and V (no secret ever appears in a captured response; no oversized payload is
ever generated or fully buffered). No new violations introduced during design; Complexity
Tracking remains empty.
