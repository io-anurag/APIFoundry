# Phase 0 Research: OpenAPI, Swagger UI & Route Discovery

No `[NEEDS CLARIFICATION]` markers remain in spec.md (confirmed during `/speckit-clarify`: no
critical ambiguities were found). This document instead records the non-obvious implementation
decisions the plan depends on.

## Starting-state audit

Before deciding anything, the existing codebase was inspected directly (not assumed from
CLAUDE.md, which predates the current implementation state):

- `openapi.yaml` (repo root) already documents 96 operations across every path introduced by
  Specs 001-011, incrementally, exactly as the constitution's Quality Gates & Spec Parity section
  and this project's own saved convention require — zero `allOf`/`oneOf`/`anyOf` combinators
  appear anywhere in it today.
- `src/openapi/index.ts` (added by Spec 001) already serves `GET /openapi.yaml` (raw text),
  `GET /openapi.json` (parsed document), and `GET /docs` (`swagger-ui-express` against the same
  parsed document) — all three already reachable with no authentication.
- `GET /api/v1/routes` does **not** exist anywhere in `src/` or `openapi.yaml`.
- No automated test compares the OpenAPI document's declared surface against the live Express
  route table — every prior spec's "spec matches implementation" claim rests on the manual
  spot-check CLAUDE.md's testing expectations describe, not an enforced test.

This narrows Spec 012's actual implementation surface to two things: (1) add the
`GET /api/v1/routes` endpoint and its documentation, and (2) add the automated spec-parity check
that turns the constitution's Quality Gate from a manual convention into an enforced regression
test — the OpenAPI document itself needs no further backfilling.

## Decision 1: A hand-authored route catalog, cross-checked against the live route table by an automated test

**Decision**: Introduce `src/data/routeRegistry.catalog.ts` — a single, flat, statically-defined
array of one entry per implemented method+path combination (method, path using the same
`{param}` bracket notation as `openapi.yaml`, a short description, and its auth requirement).
`GET /api/v1/routes` serves this array directly. Separately, add
`tests/routeParity.test.ts`, which:

1. Walks the live `app` object's actual registered Express routes (via its internal router
   stack) to produce the ground-truth set of implemented method+path pairs.
2. Asserts that set is identical (no missing, no extra) to the method+path pairs declared by
   `routeRegistry.catalog.ts`.
3. Parses `openapi.yaml`'s `paths` section and asserts that set is also identical to the same
   ground truth.

**Rationale**: A human-readable description and an auth-requirement summary (which role/scope,
if any) cannot be reliably reflected out of Express's route table at runtime — which middleware
functions are attached to a layer is not structured, typed information. A hand-authored catalog
is the only way to get accurate prose and auth annotations. But a hand-authored catalog is exactly
the kind of artifact that silently drifts from reality once nobody is required to update it — the
same failure mode this entire feature exists to close per SC-001 and FR-011. Cross-checking the
catalog against the live Express app's own route table (the single unimpeachable source of truth)
in an automated test that runs with the rest of the suite converts "we spot-checked `/docs` before
calling this done" (CLAUDE.md's existing manual gate) into a permanent regression test: any future
spec that adds, renames, or removes a route without updating both the catalog and `openapi.yaml`
now fails CI instead of silently drifting.

**Alternatives considered**:
- *Generate `GET /api/v1/routes`'s response purely by reflecting `app`'s router stack at request
  time, with no catalog.* Rejected — Express's route layers carry no human description and no
  structured auth-requirement metadata (only opaque middleware function references), so this
  would only ever produce `{method, path}` pairs, failing FR-009's requirement for a description
  and auth requirement per entry.
- *Regenerate `openapi.yaml` itself from route/decorator annotations at build time* (a
  code-first OpenAPI generator). Rejected as out of scope — it would require touching every
  controller/route file across Specs 001-011 to add annotations, far exceeding this spec's
  reconciliation-and-hardening scope, and the project has already invested in a single
  hand-authored root document kept in sync incrementally per spec (constitution).
- *Skip the automated parity test and rely on the manual spot-check CLAUDE.md already
  describes.* Rejected — that is the exact gap this feature (CLAUDE.md #28, roadmap Spec 012)
  exists to close; "verified rather than assumed" is the roadmap's own stated goal for this spec.

## Decision 2: Auth requirement represented as one flat, concrete object — never a schema union

**Decision**: Both the `RouteInfo` catalog entries and the corresponding `AuthRequirement`
OpenAPI schema use a single flat shape: `{ type: "none" | "jwt" | "apiKey" | "basic" |
"adminToken", detail?: string }`. `detail` is free text used only for the two routes whose
required role/scope is itself a path parameter (`GET /api/v1/role/{role}`,
`GET /api/v1/scope/{scope}`) and for routes that require a fixed role/scope (e.g.
`"role: admin"`, `"scope: orders:write"`); it is omitted for routes with no such extra
constraint.

**Rationale**: An audit of every route in `src/routes/*.ts` confirms no route in this codebase
accepts more than one alternative auth scheme (no route is reachable by *either* a JWT *or* an
API key, for example) — each route's `security` entry in `openapi.yaml` is already a single-item
array. A flat `type` + optional `detail` string therefore fully captures every real case without
ever needing `oneOf`/`anyOf` to express "one of several possible schemes," consistent with this
project's saved convention against schema combinators (see memory
`openapi-no-combinators`) and with `POST /admin/reset`'s `AdminResetResult` precedent (Spec 011)
of a small flat object over a composed one.

**Alternatives considered**:
- *`oneOf` over per-scheme shapes (`JwtAuthRequirement | ApiKeyAuthRequirement | ...`).*
  Rejected — directly violates the project's documented no-combinators convention and the
  downstream spec-analysis tool would flag it as an unsupported construct.
- *An array of possible schemes per route (`schemes: string[]`), to future-proof for a route
  that might someday accept more than one.* Rejected — no such route exists today (per the audit
  above) and CLAUDE.md's roadmap defines no future spec that would add one; designing for a
  hypothetical case would leave an untested code path per the project's own anti-speculation
  practice.

## Decision 3: `GET /api/v1/routes` returns a plain `{ data: RouteInfo[] }`, not the pagination envelope

**Decision**: The response is `{ "data": RouteInfo[] }` with no `pagination` object.

**Rationale**: The project's pagination envelope (constitution, CLAUDE.md) exists for
CRUD/read-oriented *resource* collections that can grow arbitrarily (users, products, etc.).
The route table is a small, fixed-size, build-time-determined list (99 entries once this feature
ships) that changes only when a developer ships a new spec — not a resource a client would ever
need to page through. Every other meta endpoint in this project (`/api/v1/info`, `/version`)
already returns a plain object rather than the pagination envelope for the same reason: it isn't
a paginated resource collection.

**Alternatives considered**:
- *Reuse the full pagination envelope (`data`, `pagination` with `page`/`limit`/`total`/...).*
  Rejected — would imply the route list is large enough to need paging and invite testing tools
  to write pagination-handling logic against an endpoint that will only ever return one page.

## Decision 4: Mount `GET /api/v1/routes` alongside `GET /api/v1/info`, same conventions

**Decision**: `src/routes/routes.routes.ts` exports `routesRouter` with `GET /routes` (mounted
under `config.apiPrefix` by `app.ts`, exactly like `infoRouter`), followed by
`routesRouter.all("/routes", methodNotAllowedHandler)`, matching `info.routes.ts`'s existing
pattern exactly.

**Rationale**: CLAUDE.md explicitly lists this endpoint as `/api/v1/routes` (under the
"Meta/health" heading alongside `/api/v1/info`), and `info.routes.ts` is the closest existing
precedent for an unauthenticated, versioned, single-purpose meta `GET` endpoint with no body and
no path/query parameters — reusing its exact shape (router file, `methodNotAllowedHandler` for
non-`GET` verbs, no auth middleware) keeps this feature consistent with the one endpoint most
like it, rather than inventing a new pattern.

**Alternatives considered**: Mounting it top-level (unprefixed), matching `/openapi.json`'s own
prefix-less mounting. Rejected — CLAUDE.md's own endpoint list places `/api/v1/routes` under the
versioned prefix, unlike `/openapi.json`/`/openapi.yaml`/`/docs`, which it lists separately and
without the prefix.
