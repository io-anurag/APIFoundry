# Implementation Plan: Automated Test Hardening, k6 Scenarios & README

**Branch**: `013-test-hardening-k6-readme` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-test-hardening-k6-readme/spec.md`

## Summary

A starting-state audit (not assumed from CLAUDE.md) found the implementation is already far along:
42 Vitest+Supertest files under `tests/` already cover CRUD, all three auth mechanisms, roles/
scopes, status codes, delays/payload, rate limiting, flaky/error-simulation, caching, files,
idempotency, admin reset, and OpenAPI/route parity (Specs 001-012), and a substantial `README.md`
already documents Specs 001-011. What is actually missing, and therefore this spec's real scope, is
three concrete gaps: (1) no code-coverage tool is installed or enforced, so FR-003's 85%-statement
gate does not yet exist; (2) no `k6/` directory or scripts exist anywhere in the repo, so none of
FR-007–FR-011's scenario categories exist yet; (3) the README stops at Spec 011, has no curl
examples, and still points readers at ROADMAP.md for "test/k6 hardening" — the exact gap this spec
closes. The plan below adds coverage tooling to the existing Vitest config, a new top-level `k6/`
directory of scenario scripts reusing the demo credentials and seed data Specs 002/005 already
define, and a README pass that documents Specs 012-013 and adds runnable curl examples — with no
change to any existing business endpoint.

## Technical Context

**Language/Version**: TypeScript 5.6 on Node.js >=20 for the test/coverage work (existing project
stack); k6 scripts are plain JavaScript executed by the external k6 binary (k6 has its own
ES-module-flavored JS runtime, unrelated to this project's `tsc`/CommonJS toolchain)

**Primary Dependencies**: Vitest 2.1 + Supertest 7.0 (existing, reused as-is) plus one new
devDependency, `@vitest/coverage-v8` (matching the already-pinned Vitest 2.1 line, V8's native
coverage instrumentation needs no source-map/Babel step); k6 itself is an external CLI tool, not an
npm dependency, run by a human/CI against a already-running server instance

**Storage**: N/A — this feature adds no persisted or in-memory store; `POST /admin/reset` has
nothing new to reset

**Testing**: Vitest 2.1 + Supertest 7.0 for the suite itself (existing harness, expanded in
coverage only where the audit finds a real gap); k6 (external, version-unpinned by this repo, per
CLAUDE.md) for the new performance/workflow scripts

**Target Platform**: Node.js server (existing) for the app under test; k6 scripts run from any
machine with the k6 CLI installed, pointed at a reachable instance via a `BASE_URL` environment
variable

**Project Type**: Single Express/TypeScript backend service (existing structure; no new project)

**Performance Goals**: Per the Session 2026-09-12 clarifications — load: 20 VUs steady/2m; stress:
ramp 20→100 VUs/5m; spike: jump to 200 VUs/30s; soak: 20 VUs/30m; concurrent-user: 50 VUs running
the full chained workflow; p95 request duration <500ms and HTTP error rate <1% on lightweight
endpoints for load/stress/concurrent-user (delay/payload endpoints excluded from the latency check)

**Constraints**: New k6 scripts MUST NOT target endpoints in a way that violates the constitution's
bounded-resource-usage principle (FR-011); the coverage threshold (FR-003) MUST run inside the
existing `npm test` path with no new external service; nothing in this feature may change the
behavior of any endpoint documented by Specs 001-012

**Scale/Scope**: 42 existing test files audited against CLAUDE.md's testing checklist (gap-closing
tasks, if any, sized during `/speckit-tasks` once the audit is itemized); 12 k6 scenario categories
(FR-007) plus 1 chained-workflow script (FR-008, may be one of the 12 or an additional file); 1
README pass adding Specs 012-013 sections and a curl-example set across ~6 feature areas (FR-012)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Testing-Playground Purpose | PASS — this feature only increases discoverability/testability (coverage gate, k6 scripts, README), and adds no restriction to the existing surface. |
| II. Determinism & Reproducibility (NON-NEGOTIABLE) | PASS — new/expanded Vitest tests must pin reproducible parameters for flaky/rate-limit endpoints (FR-005, already the codebase's established pattern via `resetStores()`); k6 scripts targeting those same endpoints must likewise use fixed, documented parameters (Edge Cases). |
| III. Fail-Safe Handling & Consistent Contracts | PASS — no endpoint behavior changes; k6/README changes are read-only from the server's perspective except where they call already-validated write endpoints (e.g. the chained-workflow script's `POST /orders`). |
| IV. Secret & Credential Hygiene | PASS — k6 scripts and README examples use only the existing seeded demo credentials (`src/data/demoAccounts.seed.ts`) and `ADMIN_TOKEN`/`JWT_SECRET` read from environment/`.env.example` placeholders, never a hardcoded real secret. |
| V. Bounded Resource Usage Under Load | PASS — k6 profiles are fixed, moderate, and documented (Technical Context above); FR-011 explicitly forbids targeting endpoints in a way that would force unbounded allocation or external calls. |
| Quality Gates & Spec Parity | PASS — FR-015's final quality gate re-runs the existing `/docs`/`/openapi.json`/`/openapi.yaml`/`/api/v1/routes` spot-check (Spec 012's parity test already covers this continuously); this feature adds a second, independent gate (test coverage) rather than replacing that one. |

No violations found.

## Project Structure

### Documentation (this feature)

```text
specs/013-test-hardening-k6-readme/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

No `contracts/` directory: this feature adds no new HTTP endpoint and no new external interface —
its only externally-visible artifacts are k6 scripts (a CLI tool's input, not a service contract)
and the README (documentation, not a machine-readable contract). Per the Phase 1 instructions, an
interface-contracts folder is skipped when a feature is internal-facing in this sense.

### Source Code (repository root)

Existing single-project Express/TypeScript layout (established by Spec 001, unchanged since) plus
one new top-level directory for k6. No existing `src/` file changes behavior; the only `src/`-
adjacent change is test/tooling configuration.

```text
package.json              # EDIT — add @vitest/coverage-v8 devDependency, a "test:coverage" script
vitest.config.ts          # EDIT — add coverage.provider "v8" + statements >=85% threshold
README.md                 # EDIT — add Spec 012/013 endpoint sections, curl examples, k6 how-to;
                           #        remove the "tracked in ROADMAP.md" forward-reference

tests/
└── (existing 42 files)   # AUDIT — cross-check against CLAUDE.md's testing checklist; new test
                           #         files added only where the audit finds a real gap (sized in
                           #         /speckit-tasks, not enumerated here)

k6/                        # NEW — top-level, sibling to src/ and tests/ (k6 is a separate
│                          #        toolchain: plain JS run by the external k6 binary, not part of
│                          #        the TypeScript/Vitest build)
├── lib/
│   ├── config.js          # NEW — BASE_URL / env-driven config shared by every script
│   ├── auth.js            # NEW — login/token-refresh helpers reused by auth-focused and
│   │                       #        chained-workflow scripts (src/data/demoAccounts.seed.ts creds)
│   └── workflow.js        # NEW — runChainedWorkflow(): single source of truth for the
│                           #        FR-008 sequence, imported by chained-workflow.js and
│                           #        concurrent-user.js so it exists in exactly one place
├── smoke.js                # NEW — 1 VU/30s sanity check across a handful of representative routes
├── load.js                  # NEW — 20 VU/2m steady load on lightweight endpoints
├── stress.js                # NEW — ramp 20→100 VU/5m
├── spike.js                  # NEW — sudden jump to 200 VU/30s then drop
├── soak.js                    # NEW — 20 VU/30m endurance run
├── latency.js                  # NEW — targets /delay and /api/v1/test?scenario=delayed, asserts
│                                #        observed latency tracks the requested delay
├── timeout.js                   # NEW — targets /api/v1/test?scenario=timeout and MAX_DELAY_MS-
│                                 #        adjacent values
├── error-rate.js                 # NEW — targets /flaky and /errors/*, expects a documented mix of
│                                  #        non-2xx statuses rather than all-success
├── auth.js                        # NEW — login/refresh/expired/revoked/scopes/roles flows
├── crud.js                         # NEW — full CRUD pass across users/products/orders/customers
├── chained-workflow.js               # NEW — FR-008's login → me → list → get → update → create
│                                      #        order → get order → delete user sequence
└── concurrent-user.js                 # NEW — 50 VUs, each independently running the shared
                                        #        chained-workflow sequence (k6/lib/workflow.js)
```

**Structure Decision**: No change to the existing `src/`/`tests/` layout or to any endpoint's
behavior. This feature is additive: one new top-level `k6/` directory (a new toolchain boundary,
kept out of `src/`/`tests/` since it is not TypeScript and not run by Vitest), plus edits to
`package.json`, `vitest.config.ts`, and `README.md`, plus whatever `tests/*.test.ts` gap-closing
files the coverage/checklist audit turns up.

## Complexity Tracking

Not applicable — Constitution Check reported no violations.
