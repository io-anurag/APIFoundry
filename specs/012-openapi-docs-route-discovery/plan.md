# Implementation Plan: OpenAPI, Swagger UI & Route Discovery

**Branch**: `012-openapi-docs-route-discovery` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-openapi-docs-route-discovery/spec.md`

## Summary

`GET /openapi.json`, `GET /openapi.yaml`, and `GET /docs` already exist (Spec 001) and already
serve the project's single, incrementally-authored root `openapi.yaml`, which already documents
every operation from Specs 001-011 with zero schema combinators. The only missing piece of this
feature's functional surface is `GET /api/v1/routes`. The real work of this spec is the
reconciliation the roadmap calls for: add that one endpoint (backed by a small hand-authored
route catalog, since Express's route table carries no human description or auth metadata), and
add an automated test that cross-checks the catalog, the OpenAPI document, and the live Express
app's actual registered routes against each other — turning "the doc matches the implementation"
from a manual spot-check into an enforced regression test.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js >=20 (existing project stack; CommonJS output via `tsc`)

**Primary Dependencies**: Express 4.21, `swagger-ui-express` 5.0.1, `js-yaml` 4.1.0 — all already
present and reused as-is; this feature adds no new npm dependency.

**Storage**: N/A — the route catalog is a static, in-memory constant array (same pattern as
existing catalogs, e.g. `src/data/testScenarios.catalog.ts`, `src/data/statusCodeDemos.catalog.ts`);
no new persisted state, nothing for `POST /admin/reset` to reset.

**Testing**: Vitest 2.1 + Supertest 7.0 (existing harness)

**Target Platform**: Node.js server (existing)

**Project Type**: Single Express/TypeScript backend service (existing structure; no new project)

**Performance Goals**: N/A beyond the constitution's general bounded-resource principle — serving
a ~97-entry static array and a pre-loaded document has no meaningful latency or throughput profile
of its own.

**Constraints**: The new route-parity test must run within the existing Vitest suite (no external
process, no network calls) and must not become flaky under the live Express app's own internal
router-stack structure (Express 4.21, already pinned).

**Scale/Scope**: 96 pre-existing documented operations (verified by direct count against
`openapi.yaml`) + 1 new operation (`GET /api/v1/routes`) = 97 total method+path combinations to
reconcile across the route catalog, the OpenAPI document, and the live app.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Testing-Playground Purpose | PASS — adds a discovery endpoint and an enforced parity check; strictly increases discoverability of the existing surface, shrinks nothing. |
| II. Determinism & Reproducibility (NON-NEGOTIABLE) | PASS — the route catalog, the OpenAPI document, and `/api/v1/routes`'s response are all static/in-memory; no randomness is introduced anywhere in this feature. |
| III. Fail-Safe Handling & Consistent Contracts | PASS — `GET /api/v1/routes` takes no input (no path/query params to validate) and returns a fixed shape; non-`GET` verbs on `/api/v1/routes` go through the existing `methodNotAllowedHandler`, matching `/api/v1/info`'s precedent. |
| IV. Secret & Credential Hygiene | PASS — the route catalog and OpenAPI document describe scheme *names*, roles, and scopes only; no secret value is ever included. |
| V. Bounded Resource Usage Under Load | PASS — serving a ~97-entry in-memory array and a pre-parsed document involves no unbounded allocation, no external calls, no expensive computation. |
| Quality Gates & Spec Parity | This feature **is** that gate: it adds the automated test that enforces doc/implementation parity, replacing the manual spot-check with a regression test. |

No violations found.

## Project Structure

### Documentation (this feature)

```text
specs/012-openapi-docs-route-discovery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── route-discovery.openapi.yaml
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

Existing single-project Express/TypeScript layout (established by Spec 001, used unchanged by
every subsequent spec) — no new top-level directory. This feature adds five small new files
across the already-established `src/` subfolders, plus two new test files, and edits two existing
files:

```text
src/
├── models/
│   └── routeInfo.ts              # NEW — RouteInfo, AuthRequirement
├── data/
│   └── routeRegistry.catalog.ts  # NEW — the hand-authored, one-entry-per-route catalog
├── services/
│   └── routeRegistry.service.ts  # NEW — listRoutes(): RouteInfo[]
├── controllers/
│   └── routes.controller.ts      # NEW — getRoutes(req, res)
├── routes/
│   └── routes.routes.ts          # NEW — GET /routes (+ methodNotAllowedHandler), mounted under config.apiPrefix
├── app.ts                        # EDIT — mount routesRouter into apiRouter, alongside infoRouter
└── (openapi.yaml, repo root)     # EDIT — merge contracts/route-discovery.openapi.yaml's path + schemas in

tests/
├── routes.test.ts                # NEW — GET /api/v1/routes behavior (shape, entry count, no auth required)
├── routeParity.test.ts           # NEW — live Express routes vs. catalog vs. openapi.yaml, three-way parity
└── helpers/
    └── listAppRoutes.ts          # NEW — introspection helper: walks app's registered routes into {method, path} pairs
```

**Structure Decision**: No structural change to the project — this feature is additive within the
existing module-per-responsibility layout (models/data/services/controllers/routes/tests) that
every prior spec already follows, plus edits to the two files (`app.ts`, `openapi.yaml`) every
prior spec has also incrementally edited.

## Complexity Tracking

Not applicable — Constitution Check reported no violations.
