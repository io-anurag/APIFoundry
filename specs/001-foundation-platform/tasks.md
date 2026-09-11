---

description: "Task list template for feature implementation"
---

# Tasks: Foundation, Config & Health

**Input**: Design documents from `/specs/001-foundation-platform/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/foundation.openapi.yaml](contracts/foundation.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `spec.md` FR-017 and the project constitution (Quality Gates & Spec Parity: "New or changed endpoints MUST include corresponding automated test coverage") explicitly require automated test coverage for this spec, so test tasks are generated tests-first per story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All file paths are relative to the repository root (`D:\api\APIFoundry`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single backend project (no frontend) — `src/`, `tests/` at repository root, exactly per `plan.md`'s Project Structure section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization per `plan.md`'s Technical Context and Project Structure.

- [ ] T001 Create the project directory skeleton (`src/config/`, `src/middleware/`, `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`, `src/utils/`, `src/openapi/`, `tests/`) per `plan.md`'s Project Structure section
- [ ] T002 [P] Initialize `package.json` with dependencies (`express`, `zod`, `pino`, `pino-http`, `cors`, `dotenv`, `swagger-ui-express`, `js-yaml`) and devDependencies (`typescript`, `tsx`, `vitest`, `supertest`, `@types/express`, `@types/cors`, `@types/js-yaml`, `@types/swagger-ui-express`, `@types/supertest`, `@types/node`) and scripts `dev` (`tsx watch src/server.ts`), `build` (`tsc`), `start` (`node dist/server.js`), `test` (`vitest run`) at repository root
- [ ] T003 [P] Create `tsconfig.json` (`strict: true`, `target: ES2022`, Node 20-compatible `module`/`moduleResolution`, `outDir: dist`, `rootDir: src`) at repository root
- [ ] T004 [P] Create `vitest.config.ts` (Node test environment, `globals: true`) at repository root
- [ ] T005 [P] Create `.env.example` at repository root listing every variable from `CLAUDE.md`'s Environment Variables section with its documented default: `PORT=3000`, `NODE_ENV=development`, `API_PREFIX=/api/v1`, `JWT_SECRET=change-me`, `JWT_ISSUER=mock-api-server`, `JWT_AUDIENCE=mock-api-client`, `JWT_EXPIRES_IN=3600`, `RATE_LIMIT_ENABLED=false`, `RATE_LIMIT_REQUESTS=100`, `RATE_LIMIT_WINDOW_MS=60000`, `MAX_DELAY_MS=10000`, `MAX_PAYLOAD_SIZE=10mb`, `FAILURE_RATE=0`, `ADMIN_TOKEN=admin-secret`, `CORS_ORIGIN=*`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config loading, error/pagination envelopes, request-id, logging, CORS, and app wiring — every user story below depends on this being complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Define the `ConfigurationProfile` zod schema in `src/config/env.schema.ts` per `data-model.md`'s field table: `port` (number, 1–65535, default `3000`), `nodeEnv` (enum `development`\|`test`\|`production`, default `development`), `apiPrefix` (non-empty string with a leading `/`, default `/api/v1`), `corsOrigin` (string, default `*`), `jwtSecret` (non-empty string, default `change-me`), `jwtIssuer` (string, default `mock-api-server`), `jwtAudience` (string, default `mock-api-client`), `jwtExpiresIn` (number seconds, default `3600`), `rateLimitEnabled` (boolean, default `false`), `rateLimitRequests` (number, default `100`), `rateLimitWindowMs` (number, default `60000`), `maxDelayMs` (number, default `10000`), `maxPayloadSize` (string byte-size literal, default `10mb`), `failureRate` (number, 0–1, default `0`), `adminToken` (non-empty string, default `admin-secret`)
- [ ] T007 Implement the config loader in `src/config/index.ts`: call `dotenv`'s `.config()`, parse `process.env` against the schema from T006, and on failure print one aggregated human-readable error listing every invalid field and `process.exit(1)`; on success export a frozen, typed `ConfigurationProfile` object (depends on T006)
- [ ] T008 [P] Implement the shared `pino` logger in `src/utils/logger.ts`, configured with `redact` paths covering `req.headers.authorization`, `req.headers.cookie`, and any logged config's `jwtSecret`/`adminToken` fields, per the constitution's secret-hygiene rule
- [ ] T009 [P] Define the `ErrorEnvelope` type in `src/models/errorEnvelope.ts` matching `{ error: { code: string; message: string; details: Record<string, unknown>; requestId: string } }` per `data-model.md`
- [ ] T010 [P] Define the `PaginationEnvelope` generic type in `src/models/paginationEnvelope.ts` matching `{ data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean } }` per `data-model.md` (FR-009 — established for reuse starting with Spec 002; no endpoint in this spec produces one)
- [ ] T011 [P] Implement the request-id middleware in `src/middleware/requestId.ts`: generate an id via `crypto.randomUUID()`, store it on `req.id`, and set it as the `X-Request-ID` header on every response
- [ ] T012 Implement the request-logging middleware in `src/middleware/requestLogger.ts` wiring `pino-http` with the logger from T008, emitting one structured entry per request containing timestamp, `req.id` (T011), method, url, status, and response time, and never a request body or header value (depends on T008, T011)
- [ ] T013 [P] Implement the CORS middleware in `src/middleware/cors.ts` using the `cors` package configured from `ConfigurationProfile.corsOrigin` (T007), supporting both a literal `*` and a comma-separated allow-list (depends on T007)
- [ ] T014 Implement the central error-handling middleware and not-found handler in `src/middleware/errorHandler.ts`, producing the `ErrorEnvelope` shape (T009) with `requestId` set from `req.id` (T011): `RESOURCE_NOT_FOUND` (404, unmatched route), `VALIDATION_ERROR` (400, malformed JSON body surfaced by the body parser), `INTERNAL_ERROR` (500, any other uncaught error) — the handler must never let an error propagate into an unhandled process crash (depends on T009, T011)
- [ ] T015 Wire the Express app in `src/app.ts`: JSON body parser, the request-id middleware (T011) mounted first, the request logger (T012), CORS (T013), an (initially empty) router mount point for story routes, then the not-found/error handler (T014) mounted last; `app.ts` must not call `listen()` (depends on T011, T012, T013, T014)
- [ ] T016 Implement the server entrypoint in `src/server.ts`: import the config (T007) and app (T015), call `app.listen(config.port)`, and log a startup message via the shared logger (T008) (depends on T007, T008, T015)

**Checkpoint**: `npm run dev` starts a server that returns a 404 `ErrorEnvelope` for any route, a 400 `ErrorEnvelope` for malformed JSON, refuses to start on invalid config, and stamps `X-Request-ID` on every response — ready for story-specific endpoints.

---

## Phase 3: User Story 1 - Confirm the server is alive and ready before testing against it (Priority: P1) 🎯 MVP

**Goal**: Health/liveness/readiness, version, and versioned-API info endpoints, each returning the documented shape.

**Independent Test**: Start the server and, per `quickstart.md`, `curl` `/health`, `/health/live`, `/health/ready`, `/version`, and `{apiPrefix}/info`, confirming each returns the correct status code and body shape.

### Tests for User Story 1

> Write these tests first; they must fail until the corresponding implementation task below lands.

- [ ] T017 [P] [US1] Write the Supertest suite in `tests/health.test.ts` asserting: `GET /health` → 200 with `HealthStatus` shape (`status: 'ok'`, `uptimeSeconds` a number, `timestamp` an ISO 8601 string); `GET /health/live` → 200 `status: 'ok'`; `GET /health/ready` → 200 `status: 'ok'` once the server has finished startup
- [ ] T018 [P] [US1] Write the Supertest suite in `tests/version.test.ts` asserting `GET /version` → 200 with `VersionInfo` shape (`version` equal to `package.json`'s version, `nodeEnv` equal to the configured environment)
- [ ] T019 [P] [US1] Write the Supertest suite in `tests/info.test.ts` asserting `GET {apiPrefix}/info` → 200 with `ApiInfo` shape (`name`, `version`, `environment`, `apiPrefix`, `uptimeSeconds`) and that the response body contains none of `jwtSecret`, `adminToken`, or any other secret configuration value

### Implementation for User Story 1

- [ ] T020 [P] [US1] Define the `HealthStatus` type in `src/models/healthStatus.ts`: `{ status: 'ok' | 'not-ready'; uptimeSeconds: number; timestamp: string }` per `data-model.md`
- [ ] T021 [P] [US1] Define the `VersionInfo` type in `src/models/versionInfo.ts`: `{ version: string; nodeEnv: string }` per `data-model.md`
- [ ] T022 [P] [US1] Define the `ApiInfo` type in `src/models/apiInfo.ts`: `{ name: string; version: string; environment: string; apiPrefix: string; uptimeSeconds: number }` per `data-model.md` — this type must never gain a secret configuration field
- [ ] T023 [US1] Implement the health service in `src/services/health.service.ts` exposing `markReady()`, `isReady()`, and `getHealthStatus(): HealthStatus` computed from `process.uptime()`, the current timestamp, and the readiness flag (depends on T020)
- [ ] T024 [US1] Implement the health controller in `src/controllers/health.controller.ts` with `getHealth` (always 200, `status: 'ok'`), `getLiveness` (always 200, `status: 'ok'`), and `getReadiness` (200 `'ok'` if `isReady()` else 503 `'not-ready'`) handlers, using the health service (T023) (depends on T023)
- [ ] T025 [P] [US1] Implement the version controller in `src/controllers/version.controller.ts` returning a `VersionInfo` (T021) built from `package.json`'s version and the config's `nodeEnv` (depends on T007, T021)
- [ ] T026 [P] [US1] Implement the info controller in `src/controllers/info.controller.ts` returning an `ApiInfo` (T022) built from `package.json`'s name/version, the config's `apiPrefix`/`nodeEnv`, and `process.uptime()` (depends on T007, T022)
- [ ] T027 [US1] Implement health routes in `src/routes/health.routes.ts` (`GET /health`, `GET /health/live`, `GET /health/ready`) wired to the health controller (T024), and mount them in `src/app.ts` outside the configured API prefix (depends on T024, T015)
- [ ] T028 [US1] Implement version routes in `src/routes/version.routes.ts` (`GET /version`) wired to the version controller (T025), and mount them in `src/app.ts` outside the configured API prefix (depends on T025, T015, T027)
- [ ] T029 [US1] Implement info routes in `src/routes/info.routes.ts` (`GET /info`) wired to the info controller (T026), and mount them in `src/app.ts` under the configured `apiPrefix` router so the full path is `{apiPrefix}/info` (depends on T026, T015, T028)
- [ ] T030 [US1] Call `healthService.markReady()` in `src/server.ts` once the `app.listen()` callback confirms the server is accepting connections (depends on T016, T023)

**Checkpoint**: User Story 1 is fully functional and independently testable — all 5 meta endpoints respond correctly end to end.

---

## Phase 4: User Story 2 - Get consistent, correlatable responses on every request (Priority: P2)

**Goal**: Prove the request-id/error-envelope/logging contract established in the Foundational phase actually holds across the routes User Story 1 added, including the negative scenarios (undefined route, malformed body, unsupported method) called out in `spec.md`.

**Independent Test**: Per `quickstart.md`, issue a valid request, a request to an undefined route, a request with a malformed JSON body, and a request using an unsupported method on a defined route; confirm every response carries `X-Request-ID` and every error response matches the documented `ErrorEnvelope` shape.

### Tests for User Story 2

- [ ] T031 [P] [US2] Write the Supertest suite in `tests/errorEnvelope.test.ts` asserting: `GET` on an undefined route → 404 `ErrorEnvelope` with `code: 'RESOURCE_NOT_FOUND'`; `POST /health` → 405 `ErrorEnvelope` with `code: 'METHOD_NOT_ALLOWED'`; `POST {apiPrefix}/info` with an invalid JSON body → 400 `ErrorEnvelope` with `code: 'VALIDATION_ERROR'`; and that a subsequent `GET /health` after each of these still returns 200 (the process never crashed)
- [ ] T032 [P] [US2] Write the Supertest suite in `tests/requestId.test.ts` asserting that responses from at least 5 distinct scenarios (200s from `/health`, `/version`, `{apiPrefix}/info`, plus the 404 and 400 from T031) each carry a non-empty `X-Request-ID` header, and that for the error responses the same value appears in `error.requestId`

### Implementation for User Story 2

- [ ] T033 [US2] Add an explicit method-not-allowed fallback (e.g. `router.all()`) to the health, version, and info routers from T027–T029 so a request to a defined path with an unsupported method reaches the `METHOD_NOT_ALLOWED` branch of the error handler (T014) instead of falling through to 404 (depends on T027, T028, T029, T014)

**Checkpoint**: Every route added by User Story 1 now demonstrably carries a request id and uses the documented error envelope for its 404/405/400 cases.

---

## Phase 5: User Story 3 - Configure and run isolated instances without code changes (Priority: P3)

**Goal**: Prove port/CORS/prefix are externally configurable, startup fails fast on bad config, and a browsable documentation surface exists.

**Independent Test**: Per `quickstart.md`, start two instances with different `PORT`/`CORS_ORIGIN` values and confirm each honors its own configuration; start one with an invalid `PORT` and confirm it fails to start with a clear error; visit `/docs`.

### Tests for User Story 3

- [ ] T034 [P] [US3] Write the Vitest suite in `tests/config.test.ts` asserting the config loader (T007) reports a descriptive, aggregated error and exits when `PORT` is set to a non-numeric or out-of-range value, and successfully loads all documented defaults when no `.env` is present
- [ ] T035 [P] [US3] Write the Supertest suite in `tests/cors.test.ts` asserting a request with an `Origin` header not present in a configured, non-`*` `CORS_ORIGIN` allow-list is rejected by the CORS middleware (T013), and one from an allowed origin succeeds

### Implementation for User Story 3

- [ ] T036 [US3] Author the seed `openapi.yaml` at the repository root, based on `contracts/foundation.openapi.yaml`'s info block, the 5 meta paths, and the `Error`/`Pagination` schemas — this becomes the single project-wide OpenAPI document later specs append to
- [ ] T037 [US3] Implement OpenAPI/Swagger wiring in `src/openapi/index.ts`: load `openapi.yaml` (T036) with `js-yaml`, expose `GET /openapi.yaml` (the raw file) and `GET /openapi.json` (the parsed document as JSON), and mount `swagger-ui-express` at `/docs` (depends on T036)
- [ ] T038 [US3] Mount the OpenAPI/Swagger router (T037) in `src/app.ts` (depends on T037, T015)

**Checkpoint**: All user stories are independently functional — configuration is externally controllable, startup is fail-fast, and `/docs` is browsable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation and spec-parity verification.

- [ ] T039 [P] Write `README.md` at repository root: project overview, install/configure/run instructions, and a summary of the endpoints this spec implements, per `CLAUDE.md`'s project structure
- [ ] T040 Run the full `quickstart.md` validation end to end (manual `curl` smoke tests, the two-instance configuration check, the fail-fast-startup check, and `npm test`) and confirm SC-001 through SC-007 all hold
- [ ] T041 Spot-check `/docs`, `/openapi.json`, and `/openapi.yaml` against the actual implemented routes and confirm they document exactly the 5 endpoints this spec implements — no more, no less (constitution's spec-parity gate) (depends on T038, T040)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - User Story 1 (P1) has no dependency on Stories 2 or 3.
  - User Story 2 (P2) depends on User Story 1's route files existing (T027–T029) to add its method-not-allowed fallback (T033) and to exercise its tests; otherwise independent.
  - User Story 3 (P3) is independent of Stories 1 and 2 (config/CORS/docs apply regardless of which routes exist), though its own tests are more meaningful once US1 routes exist to probe.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests are written first and must fail before the implementation tasks land.
- Models before services; services before controllers; controllers before routes; routes before the story's cross-cutting checkpoint.

### Parallel Opportunities

- Setup: T002, T003, T004, T005 in parallel (after T001).
- Foundational: T008, T009, T010, T011 in parallel (after T006–T007); T013 in parallel with T012.
- User Story 1: T017–T019 (tests) in parallel; T020–T022 (models) in parallel; T025–T026 (controllers) in parallel.
- User Story 2: T031–T032 (tests) in parallel.
- User Story 3: T034–T035 (tests) in parallel.
- Once Foundational (Phase 2) completes, User Story 1 and User Story 3 can be staffed in parallel; User Story 2 should follow User Story 1 since it extends US1's route files.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write the Supertest suite in tests/health.test.ts"
Task: "Write the Supertest suite in tests/version.test.ts"
Task: "Write the Supertest suite in tests/info.test.ts"

# Launch all models for User Story 1 together:
Task: "Define the HealthStatus type in src/models/healthStatus.ts"
Task: "Define the VersionInfo type in src/models/versionInfo.ts"
Task: "Define the ApiInfo type in src/models/apiInfo.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run `tests/health.test.ts`, `tests/version.test.ts`, `tests/info.test.ts`, and the manual `curl` checks in `quickstart.md`.
5. This is a usable MVP: every later spec can now build against a running server with health/version/info endpoints.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → test independently → MVP.
3. Add User Story 2 → test independently → cross-cutting contract proven.
4. Add User Story 3 → test independently → config isolation and docs proven.
5. Polish → README, full quickstart run, spec-parity spot-check.

---

## Notes

- [P] tasks touch different files with no incomplete dependency.
- Each user story is independently completable and testable per its own Independent Test above.
- Commit after each task or logical group.
- Avoid: vague tasks, two [P] tasks editing the same file (e.g. `src/app.ts` route-mounting edits are deliberately left sequential), cross-story dependencies that break independence.
