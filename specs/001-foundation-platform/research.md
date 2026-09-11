# Phase 0 Research: Foundation, Config & Health

**Feature**: `001-foundation-platform` | **Date**: 2026-09-11

`.claude/CLAUDE.md` and the project constitution already fix the stack (Node.js + Express + TypeScript,
in-memory storage, env-based config, OpenAPI 3.x + Swagger UI, Jest-or-Vitest + Supertest) and the exact
module layout. The only genuine technical decisions left open for this spec are the specific libraries
and conventions to implement that stack with. Each is recorded below in Decision / Rationale /
Alternatives form so later specs inherit one consistent choice instead of re-deciding per spec.

## Decision: Test runner — Vitest + Supertest

- **Rationale**: CLAUDE.md permits either Jest or Vitest. Vitest runs TypeScript/ESM natively (no
  `ts-jest`/Babel transform step to configure or keep in sync with `tsconfig.json`), starts faster in
  watch mode, and exposes a Jest-compatible `describe`/`it`/`expect` API, so the choice costs contributors
  nothing in familiarity while meeting SC-006 (full foundation suite under 30s) more comfortably.
  Supertest is framework-agnostic and is used unchanged.
- **Alternatives considered**: Jest + `ts-jest` — the incumbent default, but adds a slower transform step
  and a second config surface (`jest.config` + `ts-jest` options) for no behavioral benefit here.

## Decision: Environment config validation — `zod`

- **Rationale**: FR-013 requires the server to refuse to start with a clear, actionable error when
  required configuration is missing or invalid. `zod` schemas produce descriptive, field-level parse
  errors out of the box and are already TypeScript-idiomatic (schema infers the config's TS type), so the
  `config/` module can validate `process.env` once at startup and export a single typed, frozen config
  object for every other module to import.
- **Alternatives considered**: hand-rolled `if`/`throw` validation — more code, inconsistent error
  messages across variables, easy to forget a check when new env vars are added in later specs.

## Decision: Structured logging — `pino` + `pino-http`

- **Rationale**: The constitution's secret-hygiene rule (never log passwords/tokens/API keys) is easiest
  to guarantee with a logger that supports declarative field redaction (`pino`'s `redact` option) rather
  than trusting every call site to remember to scrub sensitive fields. `pino-http` produces exactly the
  structured per-request fields FR-011 requires (timestamp, method, url, status, response time) and lets
  the request-id middleware attach its id to every log line for that request.
- **Alternatives considered**: `morgan` — simpler but text-line based, no structured-field redaction, so
  guaranteeing secret hygiene would depend on discipline rather than configuration.

## Decision: Request identifier — Node's built-in `crypto.randomUUID()`

- **Rationale**: Node 20 (the target runtime) ships `crypto.randomUUID()` natively, so no dependency is
  needed to satisfy FR-007. Fewer dependencies means less surface area to keep patched.
- **Alternatives considered**: the `uuid` npm package — functionally equivalent but an unnecessary
  dependency given the native API covers the need.

## Decision: CORS — `cors` npm package, origin driven by `CORS_ORIGIN`

- **Rationale**: `cors` is the standard Express middleware for this, supports both a literal `*` and a
  comma-separated allow-list via a custom `origin` callback, satisfying FR-012/FR-014 without bespoke
  header-writing code.
- **Alternatives considered**: hand-written CORS headers — reinvents a well-tested middleware for no gain.

## Decision: OpenAPI authoring — hand-authored `openapi.yaml`, served via `swagger-ui-express`

- **Rationale**: The constitution requires `/openapi.json`/`/openapi.yaml`/`/docs` to always exactly match
  the implementation. A single hand-authored YAML file as the source of truth, loaded once with `js-yaml`
  and served as YAML directly and as JSON (by serializing the parsed object), keeps one file in sync
  instead of two. `swagger-ui-express` mounts that same parsed document at `/docs`. This spec ships the
  skeleton (info block + the endpoints it implements); later specs append their own paths/schemas to the
  same file.
- **Alternatives considered**: runtime route-decorator generation (e.g., deriving the spec from JSDoc
  annotations) — more machinery than a foundation-only skeleton needs; revisit in Spec 012 if hand
  authoring becomes unwieldy at full scale.

## Decision: Dev/build tooling — `typescript` + `tsx` (dev) + `tsc` (build)

- **Rationale**: `tsx` (esbuild-based) gives sub-second reload in `npm run dev`; `tsc` remains the
  production build/type-check step (`npm run build` → `npm start` runs compiled `dist/`). This matches
  CLAUDE.md's `npm install && npm start` / `npm run dev` contract.
- **Alternatives considered**: `ts-node-dev` — slower rebuilds than the esbuild-based `tsx`.

## Decision: Environment loading — `dotenv` package, loaded before config validation

- **Rationale**: Explicit `import 'dotenv/config'` (or an explicit `.config()` call) at the top of
  `config/` keeps `.env` loading and zod validation as one deterministic, testable step, and works across
  the Node version range the project supports (Node's native `--env-file` flag requires a newer minor
  than the project should assume as a hard floor).
- **Alternatives considered**: Node's native `--env-file` CLI flag — would tie `.env` loading to how the
  process is launched rather than to application code, complicating `npm test` and programmatic startup
  in Supertest.

## Runtime target

- **Decision**: Node.js 20.x (current LTS at time of writing).
- **Rationale**: Matches the native `crypto.randomUUID()` and modern TypeScript/ESM tooling decisions
  above; no feature in this spec requires a newer or older runtime.

All unknowns from the Technical Context are resolved above; none remain marked `NEEDS CLARIFICATION`.
