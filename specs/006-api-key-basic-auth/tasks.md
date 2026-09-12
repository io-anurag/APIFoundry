---

description: "Task list template for feature implementation"
---

# Tasks: API Key & Basic Auth

**Input**: Design documents from `/specs/006-api-key-basic-auth/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api-key-basic-auth.openapi.yaml](contracts/api-key-basic-auth.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations and the constitution's Quality Gates
("new or changed endpoints MUST include corresponding automated test coverage ... before being
considered done") make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. `POST /auth/api-key` is a single endpoint shared by
User Stories 1 and 3 (the `kind` parameter selects `valid` vs. `expired`/`revoked`), so per
research.md Decision 3 the complete `kind` switch is built once, in User Story 1; User Story 3
then owns the dedicated test coverage that verifies its `expired`/`revoked` slice of that
already-built behavior — mirroring how Spec 004 built its full path-parameter validator once and
let later stories own only test coverage. Basic Auth (User Story 4) is entirely independent of
the API key stories (research.md Decisions 4-5) and shares no file with them except `src/app.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-005 layout. New files land in the existing `src/auth/` module (already reserved by
CLAUDE.md's project structure and already used by Spec 005) — no new top-level directory. No
changes to any Spec 002/003/004/005 file other than `src/app.ts` (route mounting), `src/utils/
logger.ts` (redact-list extension), and `tests/helpers/resetStores.ts` (store reset).

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure.

No setup tasks are needed: this feature adds no new dependency, environment variable, or shared
constant beyond what Phase 2 (Foundational) creates from scratch (Technical Context, research.md
Decisions 2 and 6).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared models, stores, generation/parsing logic, and enforcing middleware every
user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Create `src/models/apiKey.ts`: `export const API_KEY_KINDS = ["valid", "expired",
      "revoked"] as const;` and `export type ApiKeyKind = (typeof API_KEY_KINDS)[number];`; `export
      type ApiKeyStatus = "active" | "expired" | "revoked";`; an `ApiKey` interface — `id: string`
      (holds the **raw key value**, satisfying `KeyedStore<T extends { id: string }>`, per
      research.md Decision 1 — never rendered under the name `id` in any response), `keyId: string`
      (UUID, the non-secret, human-facing identifier), `label: string | null`, `revoked: boolean`,
      `issuedAt: string` (ISO 8601), `expiresAt: string | null` (data-model.md's ApiKey table).
- [X] T002 [P] Create `src/data/basicAuthAccount.seed.ts`: export a single fixed constant
      `BASIC_AUTH_DEMO_ACCOUNT: { username: string; password: string }` with one hardcoded
      username/password pair (research.md Decision 4 — plaintext, feature-owned, independent of
      Spec 005's demo accounts and the Spec 002 `users` resource). Not a store — no `reset()`,
      no lifecycle.
- [X] T003 Create `src/models/apiKeyRequests.ts` (depends on T001): `apiKeyIssueRequestSchema`
      (zod: `label: z.string().min(1).max(100).optional()`, `kind:
      z.enum(API_KEY_KINDS).optional()`, `.strict()`) — matches data-model.md's validation rules
      and `contracts/api-key-basic-auth.openapi.yaml`'s `ApiKeyIssueRequest` schema exactly
      (`label` 1-100 chars, `kind` one of `valid`/`expired`/`revoked`, no other fields accepted).
- [X] T004 Create `src/data/apiKey.store.ts` (depends on T001): `export const apiKeyStore =
      createKeyedStore<ApiKey>();` reusing the existing generic from `./keyedStore` — no new store
      type needed, mirroring `session.store.ts` (research.md Decision 1).
- [X] T005 Update `tests/helpers/resetStores.ts` (depends on T004): add `apiKeyStore.reset([])` to
      `resetStores()` so every test file starts with a clean API key store, matching the existing
      per-file `beforeEach` convention (`sessionStore.reset([])` is already there from Spec 005).
- [X] T006 Create `src/auth/apiKey.ts` (depends on T001): `generateApiKey(): string` — returns
      `crypto.randomBytes(32).toString("hex")` (research.md Decision 2 — 256 bits of entropy, no
      new dependency); `computeStatus(key: ApiKey): ApiKeyStatus` — returns `"revoked"` if
      `key.revoked`; else `"expired"` if `key.expiresAt !== null && Date.parse(key.expiresAt) <=
      Date.now()`; else `"active"` (data-model.md's computed-status function, verbatim).
- [X] T007 [P] Create `src/auth/basicAuth.ts`: `parseBasicAuthHeader(header: string | undefined):
      { username: string; password: string } | null` — returns `null` if `header` is missing or
      does not start with `"Basic "`; returns `null` if the remainder is not valid base64; else
      decodes it and splits on the **first** `:` only (a password may itself contain a colon, per
      the Edge Cases section), returning `{ username, password }` (research.md Decision 5). Never
      throws.
- [X] T008 Create `src/middleware/apiKeyAuth.ts` (depends on T001, T004, T006): augment Express via
      `declare global { namespace Express { interface Request { apiKey?: { keyId: string; label:
      string | null } } } }`. The `apiKeyAuth` middleware: reads `req.header("X-API-Key")`; an
      empty string or missing header → `401` (`error.code: "UNAUTHORIZED"`, reason `"missing"`,
      per the Edge Cases section — never a partial match); look up `apiKeyStore.get(key)` — not
      found → `401` reason `"unrecognized"`; found → `computeStatus(record)` — `"expired"` → `401`
      reason `"expired"`; `"revoked"` → `401` reason `"revoked"`; `"active"` → set `req.apiKey =
      { keyId: record.keyId, label: record.label }` and call `next()` (FR-003, FR-010).
- [X] T009 Create `src/middleware/basicAuth.ts` (depends on T002, T007): augment Express via
      `declare global { namespace Express { interface Request { basicAuthUser?: { username:
      string } } } }`. The `basicAuth` middleware: calls `parseBasicAuthHeader(req.headers
      .authorization)`; `null` → `401` reason `"malformed"` (covers both a missing header and an
      unparseable one, per the Edge Cases section on duplicate/wrong-scheme headers, distinct from
      a wrong-credential rejection); non-null but `username`/`password` don't both exactly match
      `BASIC_AUTH_DEMO_ACCOUNT` → `401` with the same generic message for wrong-username and
      wrong-password (never reveal which, FR-011/Edge Cases); match → set `req.basicAuthUser =
      { username }` and call `next()` (FR-004, FR-011).
- [X] T010 [P] Update `src/utils/logger.ts` (independent of T001-T009): add
      `"req.headers['x-api-key']"` to the existing `redact.paths` array, alongside
      `"req.headers.authorization"` and `"req.headers.cookie"` (FR-015 — no response or log line
      may ever contain an API key value).

**Checkpoint**: Foundation ready — models, stores, generation/parsing helpers, and both enforcing
middlewares exist and are independently unit-testable; user story implementation can now begin.

---

## Phase 3: User Story 1 - Issue and Use an API Key (Priority: P1) 🎯 MVP

**Goal**: `POST /auth/api-key` issues a new, active key; `GET /api-key/protected` grants access
with it and rejects every missing/unrecognized case.

**Independent Test**: `POST /auth/api-key` → obtain a key → `GET /api-key/protected` with it →
`200`. See quickstart.md Scenario 1.

### Implementation for User Story 1

- [X] T011 [US1] Create `src/services/apiKey.service.ts` (depends on T003, T004, T006):
      `issueApiKey(rawBody: unknown)` — `apiKeyIssueRequestSchema.parse(rawBody)`; `kind` defaults
      to `"valid"` when omitted. Build the record per research.md Decision 3's **full** switch
      (built once, here, for all three `kind` values — User Story 3 below adds test coverage for
      the `expired`/`revoked` branches, not new implementation): `valid` → `revoked: false`,
      `expiresAt: null`; `expired` → `revoked: false`, `expiresAt: new Date(Date.now() -
      10_000).toISOString()` (10 seconds in the past — deterministically already-expired, forever,
      mirroring Spec 005's `EXPIRED_OFFSET_SECONDS` pattern); `revoked` → `revoked: true`,
      `expiresAt: null`. In every case: `id: generateApiKey()`, `keyId: randomUUID()`, `label:
      body.label ?? null`, `issuedAt: new Date().toISOString()`. Call `apiKeyStore.create(record)`,
      then return `{ apiKey: record.id, keyId: record.keyId, label: record.label, status:
      computeStatus(record), issuedAt: record.issuedAt, expiresAt: record.expiresAt }` (FR-001,
      FR-006, FR-007, FR-008).
- [X] T012 [US1] Create `src/controllers/apiKey.controller.ts` (depends on T011): `issueApiKey(req,
      res)` → `res.status(201).json(apiKeyService.issueApiKey(req.body))`; `getApiKeyProtected(req,
      res)` → `res.status(200).json({ granted: true, keyId: req.apiKey!.keyId, label:
      req.apiKey!.label })` (reachable only after `apiKeyAuth` (T008) has already set `req.apiKey`,
      so `granted` is always `true` here — the `401` case never reaches this handler).
- [X] T013 [US1] Create `src/routes/apiKey.routes.ts` (depends on T012, T008): `export const
      apiKeyRouter = Router({ strict: true });` mount `POST /auth/api-key` (no middleware —
      unauthenticated by design, per spec.md's Assumptions, mirroring `POST /auth/token`) →
      `apiKeyController.issueApiKey`; `GET /api-key/protected` (`apiKeyAuth`) →
      `apiKeyController.getApiKeyProtected`; `methodNotAllowedHandler` for each path, following the
      existing `auth.routes.ts` style.
- [X] T014 [US1] Wire `apiKeyRouter` into `src/app.ts` (depends on T013): mount it top-level
      (alongside `authRouter`, *not* under `apiRouter`), matching CLAUDE.md's `/auth/api-key` and
      `/api-key/protected` path spelling (no `/api/v1` prefix).
- [X] T015 [P] [US1] Create `tests/apiKey.test.ts` (depends on T014) covering spec.md User Story
      1's acceptance scenarios 1-4 and relevant Edge Cases: `POST /auth/api-key` with no body →
      `201` with `apiKey`, `keyId`, `label: null`, `status: "active"`, `issuedAt`, `expiresAt:
      null`; `POST /auth/api-key` with `{"label":"ci-suite"}` → `201` with `label: "ci-suite"`;
      the freshly issued key on `GET /api-key/protected` via `X-API-Key` → `200` with `granted:
      true` and the matching `keyId`/`label`; no `X-API-Key` header → `401`; an empty-string or
      whitespace-only `X-API-Key` → `401` (never a partial match, Edge Cases); a well-formed but
      never-issued `X-API-Key` value → `401`.

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md
Scenario 1).

---

## Phase 4: User Story 2 - Revoke an API Key (Priority: P2)

**Goal**: `POST /auth/api-key/revoke` revokes a key presented via `X-API-Key`, is idempotent, and
returns `404` for a key this system never issued.

**Independent Test**: Issue a key → revoke it via `X-API-Key` → `GET /api-key/protected` with it
→ `401`. See quickstart.md Scenario 2.

### Implementation for User Story 2

- [X] T016 [US2] Extend `src/services/apiKey.service.ts` (depends on T011) with
      `revokeApiKey(rawKey: string | undefined)` — an empty/undefined `rawKey` → throw
      `HttpError(401, "UNAUTHORIZED", "Missing X-API-Key header")` (consistent with how the
      protected endpoint treats a missing key, per the Edge Cases section, rather than a false
      `404`); look up `apiKeyStore.get(rawKey)` — not found → throw `HttpError(404,
      "RESOURCE_NOT_FOUND", "API key not found")`; found → `apiKeyStore.replace(rawKey, (existing)
      => ({ ...existing, revoked: true }))` (a no-op write if already revoked, making a second
      call idempotent, FR-002).
- [X] T017 [US2] Extend `src/controllers/apiKey.controller.ts` (depends on T016, T012) with
      `revokeApiKey(req, res)` → `apiKeyService.revokeApiKey(req.header("X-API-Key") ??
      undefined); res.status(200).json({})`.
- [X] T018 [US2] Extend `src/routes/apiKey.routes.ts` (depends on T017, T013) with `POST
      /auth/api-key/revoke` — **not** gated by the `apiKeyAuth` middleware (its handler performs
      its own lookup so it can distinguish `401` missing vs. `404` unknown vs. idempotent `200`,
      which the enforcing `apiKeyAuth` middleware's uniform-401 semantics can't express, mirroring
      how Spec 005's `/auth/logout` bypasses `authenticate` for the same reason); add
      `methodNotAllowedHandler`.
- [X] T019 [P] [US2] Extend `tests/apiKey.test.ts` (depends on T015) with spec.md User Story 2's
      acceptance scenarios 1-4 and Edge Cases: revoke a freshly issued, active key → `200`; the
      same key on `GET /api-key/protected` → `401` with a reason indicating revocation; revoking
      that same key again → `200` (idempotent, not an error); revoking a well-formed but
      never-issued key → `404`; revoking with no `X-API-Key` header at all → `401`, not `404`
      (Edge Cases).

**Checkpoint**: User Stories 1 and 2 both work independently (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Issue Purpose-Built Keys for Automated Testing (Priority: P3)

**Goal**: `POST /auth/api-key` with `kind: "expired"` or `kind: "revoked"` deterministically
produces a key already in that state, without waiting on real time or an extra revoke call.

**Independent Test**: `POST /auth/api-key` with each `kind` value, then confirm
`GET /api-key/protected`'s accept/reject behavior for each. See quickstart.md Scenario 3.

> **Note**: `issueApiKey` (T011) already implements the full `kind` switch (`valid`/`expired`/
> `revoked`) per research.md Decision 3 — this story's task is the dedicated test coverage that
> verifies the `expired` and `revoked` branches end-to-end through the real HTTP endpoint, not a
> new implementation.

### Tests for User Story 3

- [X] T020 [P] [US3] Extend `tests/apiKey.test.ts` (depends on T015) with spec.md User Story 3's
      acceptance scenarios 1-3: `POST /auth/api-key` with `{"kind":"expired"}` → `201` with
      `status: "expired"` and `expiresAt` already in the past, and that key on
      `GET /api-key/protected` → `401` with a reason indicating expiry; `POST /auth/api-key` with
      `{"kind":"revoked"}` → `201` with `status: "revoked"`, and that key on
      `GET /api-key/protected` → `401` with a reason indicating revocation; `POST /auth/api-key`
      with an unknown `kind` value (e.g. `"bogus"`) → `400`.

**Checkpoint**: User Stories 1, 2, and 3 all work independently (quickstart.md Scenario 3) — the
full API key feature is complete.

---

## Phase 6: User Story 4 - Demonstrate HTTP Basic Auth (Priority: P4)

**Goal**: `GET /auth-test/basic` correctly distinguishes valid, wrong-password/unknown-username,
missing, and malformed Basic Auth credentials.

**Independent Test**: `GET /auth-test/basic` with valid demo credentials (`200`), a wrong password
(`401`), no header (`401`), and a non-Basic header (`401`). See quickstart.md Scenario 4.

### Implementation for User Story 4

- [X] T021 [US4] Create `src/controllers/basicAuth.controller.ts` (depends on T009): `getBasicAuthDemo(req,
      res)` → `res.status(200).json({ authenticated: true, username: req.basicAuthUser!.username
      })` (reachable only after `basicAuth` (T009) has already verified the credentials, so
      `authenticated` is always `true` here — the `401` case never reaches this handler).
- [X] T022 [US4] Create `src/routes/basicAuth.routes.ts` (depends on T021, T009): `export const
      basicAuthRouter = Router({ strict: true });` mount `GET /auth-test/basic` (`basicAuth`) →
      `basicAuthController.getBasicAuthDemo`; `methodNotAllowedHandler` for other methods.
- [X] T023 [US4] Wire `basicAuthRouter` into `src/app.ts` (depends on T022): mount it top-level
      (alongside `authRouter`/`apiKeyRouter`), matching CLAUDE.md's `/auth-test/basic` path
      spelling (no `/api/v1` prefix).
- [X] T024 [P] [US4] Create `tests/basicAuth.test.ts` (depends on T023) covering spec.md User
      Story 4's acceptance scenarios 1-4 and Edge Cases: valid demo username/password via HTTP
      Basic → `200` with `{ authenticated: true, username: "<demo-username>" }`; the demo username
      with a wrong password → `401`; an unknown username → `401` with the *same* error shape as
      wrong-password (never reveal whether the username exists); no `Authorization` header at all
      → `401`; a header that is not `"Basic ..."` (e.g. `"Bearer ..."`) → `401`, distinguishable
      by message from the wrong-credential case; a decoded payload with no `:` separator, and one
      whose username or password itself contains a `:` (split on the *first* colon only, per the
      Edge Cases section) → handled without crashing.

**Checkpoint**: All four user stories independently functional (quickstart.md Scenario 4).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [X] T025 [P] Merge `contracts/api-key-basic-auth.openapi.yaml`'s `tags`, `paths`,
      `components.securitySchemes` (`apiKeyAuth`, `basicAuth`), `components.schemas`, into the
      root `openapi.yaml`, reusing the existing `Error`/`Unauthorized`/`NotFound`/
      `ValidationError` schemas/responses rather than duplicating them, so `/docs`,
      `/openapi.json`, and `/openapi.yaml` document exactly the 4 operations this spec implements
      (constitution: Quality Gates & Spec Parity). No `allOf`/`oneOf`/`anyOf` combinators.
- [X] T026 Run `npm test` and confirm the full suite — Specs 001-005's existing tests plus
      `tests/apiKey.test.ts` and `tests/basicAuth.test.ts` — passes.
- [X] T027 Execute the manual validation scenarios in
      `specs/006-api-key-basic-auth/quickstart.md` against a running `npm run dev` server and
      confirm every expected status code and state.
- [X] T028 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 4
      new endpoints correctly (including their `apiKeyAuth`/`basicAuth` security requirements),
      with no schema errors. Note: `GET /api/v1/routes` is not yet implemented in this codebase
      (Spec 012's deliverable per the roadmap) — verified instead that `/openapi.json` lists
      exactly the 4 documented paths and every `$ref` in them resolves.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks — nothing to configure for this feature.
- **Foundational (Phase 2)**: BLOCKS all user stories. T001 and T002 are independent and run in
  parallel; T003, T004, T006 each depend on T001; T005 depends on T004; T007 is independent of
  everything else in this phase; T008 depends on T001+T004+T006; T009 depends on T002+T007; T010
  is independent of everything else in this phase.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Delivers the issue+use cycle
  every later API-key story builds on.
- **User Story 2 (Phase 4)**: Depends on Foundational, and extends US1's `apiKey.service.ts`
  (T011), `apiKey.controller.ts` (T012), and `apiKey.routes.ts` (T013) — sequential with US1 on
  those shared files, but independently testable once its own tasks land.
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's `issueApiKey` (T011) already
  implementing the full `kind` switch — adds only test coverage, no new implementation file.
- **User Story 4 (Phase 6)**: Depends on Foundational only (`basicAuth` middleware, T009) —
  entirely independent of US1/US2/US3's files; may proceed in parallel with any of them.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- US1: service → controller → routes → `app.ts` wiring → tests, in that order.
- US2: extends US1's service/controller/routes files in the same order, then tests.
- US3: tests only — extends the file US1's T015 created.
- US4: controller → routes → `app.ts` wiring → tests, independent of US1/US2/US3.

### Parallel Opportunities

- T001 and T002 (Foundational) run in parallel — different files, no cross-dependencies.
- T007 and T010 (Foundational) are independent of the rest of the phase and of each other.
- Once Foundational completes, User Story 4 (Phase 6) can proceed fully in parallel with User
  Stories 1-3, since it shares no file with them except `src/app.ts`.
- T015 (US1), T019 (US2), and T020 (US3) all extend the same `tests/apiKey.test.ts` file — treat
  them as sequential in execution even though independent in content, so the later story's edit
  appends rather than conflicts with the earlier one's.
- T025 and T028 (Polish) run in parallel; T026 and T027 are sequential whole-suite/manual checks.

---

## Parallel Example: Foundational

```bash
# These four Foundational tasks have no cross-dependencies and can start together:
Task: "Create src/models/apiKey.ts"
Task: "Create src/data/basicAuthAccount.seed.ts"
Task: "Create src/auth/basicAuth.ts"
Task: "Update src/utils/logger.ts redact list"
```

## Parallel Example: User Story 4 alongside User Stories 1-3

```bash
# Once Foundational is done, these touch entirely different files:
Task: "Implement POST /auth/api-key, GET /api-key/protected, POST /auth/api-key/revoke (User Stories 1-3)"
Task: "Implement GET /auth-test/basic (User Story 4)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
2. Complete Phase 3: User Story 1 (issue + use, full test coverage).
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
4. Deploy/demo if ready — this alone gives testing tools a working API-key mechanism.

### Incremental Delivery

1. Foundational → shared models/stores/middleware ready.
2. User Story 1 → test independently → deploy/demo (MVP!).
3. User Story 2 → test independently → deploy/demo.
4. User Story 3 → test independently → deploy/demo (no new implementation, just verified
   coverage of already-built behavior).
5. User Story 4 → test independently → deploy/demo.
6. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple developers, after Foundational lands: Developer A takes US1 → US2 → US3
(sequential, shared `apiKey.*` files); Developer B takes US4 — B can start immediately in
parallel with A, since US4 shares no file with the API key stories except `src/app.ts`.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks (except where noted, e.g.
  T015/T019/T020 all extend the same test file).
- [Story] label maps a task to its user story for traceability.
- `issueApiKey` (T011) is the single mechanism satisfying FR-001, FR-006, and FR-007 together for
  all three `kind` values; US3's test task verifies it, it does not re-implement it.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story
  dependencies that would break a later story's ability to be demoed on its own once User Story 1
  exists.
