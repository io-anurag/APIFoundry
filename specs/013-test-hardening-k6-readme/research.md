# Phase 0 Research: Automated Test Hardening, k6 Scenarios & README

No `[NEEDS CLARIFICATION]` markers remain in spec.md (three were resolved interactively during
`/speckit-clarify`: k6 concurrency/duration profile, k6 latency/error-rate thresholds, and the
code-coverage completion gate). This document records the starting-state audit and the non-obvious
implementation decisions the plan depends on.

## Starting-state audit

The existing codebase was inspected directly rather than assumed from CLAUDE.md or the roadmap:

- `tests/` already contains 42 Vitest+Supertest files covering health/version/info, full CRUD for
  users/products/orders/customers, categories/posts/comments/reviews/payments, search, status
  codes, JWT auth (login/refresh/token/token-info/protected/roles/scopes), API key + Basic auth,
  delay/payload/content/headers/cookies, rate limiting, flaky, cache/ETag, files, error scenarios,
  the generic test-scenario endpoint, admin reset, CORS, request-id, the error envelope, and
  OpenAPI/route parity — i.e. essentially every feature area CLAUDE.md's Testing Expectations
  names already has at least one test file. `tests/helpers/resetStores.ts` already delegates to
  the same `resetDataStores`/`resetAuthStores` functions `POST /admin/reset`/`POST /admin/auth/
  reset` use, so tests already reset state via the production reset path rather than a parallel
  mechanism (FR-004's isolation requirement is already the codebase's established pattern, not new
  ground this feature breaks).
- No coverage tool is installed (`package.json` has no `@vitest/coverage-v8`/`c8`/`nyc`, and
  `vitest.config.ts` has no `coverage` block) or run, despite `.gitignore` already anticipating a
  `coverage/` output directory. FR-003's 85%-statement gate is a real, currently-unmet gap.
- No `k6/` directory, or any file mentioning k6, exists anywhere in the repo. FR-007–FR-011 are a
  real, currently-unmet gap in full.
- `README.md` (30KB) already documents Specs 001-011 in detail (tech stack, install/run, one
  endpoint table per spec, response shapes, spec-documentation index) but explicitly defers "OpenAPI/
  route discovery hardening and test/k6 hardening" to ROADMAP.md, and contains zero `curl` examples
  anywhere. FR-012–FR-014 are a real, currently-unmet gap.
- `src/data/demoAccounts.seed.ts` already defines four fixed demo accounts (`demo.user`,
  `demo.admin`, `demo.manager`, `demo.readonly`) with fixed passwords and role/scope assignments,
  usable as-is by both k6 scripts and README curl examples with no new seed data needed.
- Rate limiting keys its counter by `X-API-Key` header when present, else request IP
  (`resolveCallerIdentity`) — relevant to how a rate-limit-focused k6 script must assign per-VU
  identity to avoid every VU (same source IP) colliding on one shared counter unless that
  collision is the scenario's actual point.
- `GET /flaky`'s failure decision consumes a shared, seeded, in-process PRNG
  (`utils/seededRandom.ts`) — deterministic across a single server process's request sequence, but
  not something an external k6 process can predict call-by-call. A k6 script exercising `/flaky`
  must therefore assert on the *aggregate* failure proportion over enough calls approximating the
  requested `failureRate`, not on a specific per-call outcome.

This narrows the feature's actual implementation surface to exactly the three gaps identified
above — coverage tooling, k6 scripts, and a README pass — with the existing 42-file suite audited
for completeness (see Decision 4) rather than rebuilt.

## Decision 1: Coverage tool — `@vitest/coverage-v8`, statements-only threshold, wired into the existing `npm test`

**Decision**: Add `@vitest/coverage-v8` (matching the already-pinned Vitest 2.1 line) as a
devDependency. Add a `coverage` block to `vitest.config.ts`:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "html", "lcov"],
  include: ["src/**/*.ts"],
  thresholds: { statements: 85 },
}
```

Add `"test:coverage": "vitest run --coverage"` to `package.json` scripts, run explicitly (not
folded into the plain `npm test` used by every quick local run) so day-to-day `npm test` stays
fast; the coverage-gated run is what FR-015's final quality-gate sequence and CI invoke.

**Rationale**: V8's native instrumentation needs no source-map/Babel transform step and is Vitest's
own documented default provider, minimizing new moving parts. The clarified scope is statement
coverage specifically (Session 2026-09-12, Q3) — branch/function/line thresholds are left
unconfigured (still reported, not gating) rather than inventing additional numeric targets nobody
asked for. `coverage/` is already `.gitignore`d, confirming this was anticipated but never wired
up.

**Alternatives considered**:
- *`c8` or `istanbul`/`nyc` directly.* Rejected — `@vitest/coverage-v8` is Vitest's own first-party
  integration for the exact provider already chosen, with no extra config glue needed.
- *Fold coverage into the default `npm test`.* Rejected — coverage instrumentation measurably slows
  every run; keeping `npm test` fast for local iteration while adding a dedicated `test:coverage`
  script (used by the CI/final-quality-gate path) matches common Vitest project practice and avoids
  slowing down the everyday inner loop for a check only the completion gate needs.

## Decision 2: k6 scripts live in a new top-level `k6/` directory, driven by a `BASE_URL` env var

**Decision**: New top-level `k6/` directory (sibling to `src/`/`tests/`), with `k6/lib/config.js`
(reads `__ENV.BASE_URL`, default `http://localhost:3000`) and `k6/lib/auth.js` (shared
login/refresh helpers built on `demoAccounts.seed.ts`'s fixed credentials). One script per scenario
category (FR-007) plus the chained-workflow script (FR-008), each a plain k6-flavored JS module
with its own `options` (VU/duration profile) and `thresholds` block per the Session 2026-09-12
clarifications.

**Rationale**: k6 scripts are executed by the external k6 binary, which has its own JS runtime
(not Node's CommonJS/ESM, and not compiled by `tsc`) — mixing them into `src/` or `tests/` would
imply they participate in the TypeScript build or the Vitest run, neither of which is true. A
`BASE_URL` env var (k6's own idiomatic `__ENV` mechanism) lets the same scripts target a local dev
server, a CI-started instance, or a deployed one without editing the scripts themselves.

**Alternatives considered**:
- *Put k6 scripts under `tests/k6/`.* Rejected — `tests/` is Vitest's configured `include` root
  (`tests/**/*.test.ts`); mixing in non-`.test.ts`, non-TypeScript files there is confusing evidence
  contrary to that directory's established single purpose, without gaining anything Vitest would
  actually use.
- *Hardcode `http://localhost:3000` in every script.* Rejected — makes CI (which may start the
  server on a different host/port) or a deployed-instance run impossible without editing every
  script file.

## Decision 3: Rate-limit- and flaky-focused k6/test coverage assert on aggregate/documented behavior, not exact per-call outcomes

**Decision**: The rate-limit-focused k6 script (part of `error-rate.js` or its own concern) assigns
each virtual user a distinct `X-API-Key` header value (e.g. derived from `__VU`) so concurrent VUs
don't collide on one shared IP-keyed counter unless a script explicitly wants to demonstrate that
collision. The flaky/error-rate script asserts the *proportion* of non-2xx responses across many
requests approximates the `failureRate` query parameter it passed, with a tolerance band, rather
than asserting a specific call fails.

**Rationale**: `resolveCallerIdentity` keys rate-limit counters by `X-API-Key` when present, else
by IP (all k6 VUs share the load-generator's IP), so an un-keyed multi-VU rate-limit script would
have every VU fighting over one counter — a real but easily-misread failure mode. `/flaky`'s
outcome is drawn from a shared, seeded, in-process PRNG the k6 process cannot predict call-by-call;
only the aggregate proportion over a sufficient sample size is a meaningful, deterministic-enough
assertion (consistent with the constitution's determinism principle, which requires *reproducible*
behavior for these endpoints, not literally invariant per-call output).

**Alternatives considered**:
- *Assert on exact per-call `/flaky` outcomes from k6.* Rejected — the PRNG sequence is internal to
  the server process and not something an external HTTP client can predict or replay.
- *Let all rate-limit VUs share one identity to deliberately test contention.* Considered valid for
  a dedicated scenario, but the default `error-rate`/`load` scripts use distinct per-VU identities
  so their pass/fail signal reflects the target endpoints' general behavior, not an artifact of
  shared-IP contention.

## Decision 4: Test-suite gap audit method — inventory now, size gap-closing tasks in `/speckit-tasks`

**Decision**: This plan records that the 42 existing test files already map onto essentially every
feature area in CLAUDE.md's Testing Expectations (see Starting-state audit above and
`data-model.md`'s coverage inventory table). The exhaustive, assertion-by-assertion audit needed to
confirm zero remaining gaps (FR-002, SC-001's "verified by inventory rather than assumed") — and
any resulting gap-closing test files — is itemized as concrete tasks in `/speckit-tasks`, not
enumerated line-by-line here.

**Rationale**: Producing a reliable per-checklist-item pass/fail verdict requires reading every
assertion in 42 test files against every sub-bullet of CLAUDE.md's Testing Expectations section —
a large, mechanical, and highly task-shaped piece of work that belongs in the tasks phase (where it
can be tracked, checked off, and independently verified) rather than asserted wholesale in a
planning document.

**Alternatives considered**:
- *Declare the suite fully compliant based on file-name coverage alone.* Rejected — a test file
  named `rateLimit.test.ts` existing is not proof every edge case CLAUDE.md names (e.g. the
  `Retry-After` header, the exact 429 body) is actually asserted inside it; SC-001 explicitly
  requires verification, not assumption.

## Decision 5: README additions extend the existing single-document structure; no new docs site

**Decision**: Add `### OpenAPI, Swagger UI & Route Discovery (Spec 012)` and
`### Test Hardening, k6 Scenarios & README (Spec 013)` sections following the existing per-spec
`### ... (Spec NNN)` pattern already used for Specs 001-011, add a new `## Examples` section with
curl commands per FR-012/FR-013, add a `## Performance testing with k6` section documenting how to
run each script and against what `BASE_URL`, and remove the now-resolved "tracked in ROADMAP.md"
forward-reference sentence.

**Rationale**: Matches this project's own established README convention (verified by reading the
file directly) rather than introducing a competing structure or a multi-page docs site, which the
spec's Assumptions section already rules out.

**Alternatives considered**: A separate `docs/` folder or static site generator. Rejected — out of
scope per spec.md's Assumptions ("a single top-level document"), and unnecessary for a project this
size that already maintains one coherent `README.md`.
