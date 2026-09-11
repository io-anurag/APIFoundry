---

description: "Task list template for feature implementation"
---

# Tasks: JWT Authentication, Roles & Scopes

**Input**: Design documents from `/specs/005-jwt-auth-roles-scopes/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/jwt-auth-roles-scopes.openapi.yaml](contracts/jwt-auth-roles-scopes.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations and the constitution's Quality Gates ("new or
changed endpoints MUST include corresponding automated test coverage ... before being considered done")
make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation
and testing of each story. This feature's shared primitives (JWT signing/verification, the session
store, scope/role validators, and the enforcing `authenticate` middleware) are built once in
Foundational, per research.md Decisions 1-6 and 10; each user story then owns only the
endpoints/handlers/tests specific to its own slice of behavior.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec 001-004
layout. New top-level module: `src/auth/` (already reserved by CLAUDE.md's project structure). No
changes to any Spec 002/003/004 file — this feature has no dependency on those resources.

---

## Phase 1: Setup

**Purpose**: The one new dependency this feature needs.

- [X] T001 Add `jsonwebtoken` and `@types/jsonwebtoken` to `package.json` (dependencies and
      devDependencies respectively) and run `npm install` (research.md Decision 1: `jsonwebtoken` over
      a hand-rolled HMAC signer, for distinguishable `TokenExpiredError`/`JsonWebTokenError` types).

**Checkpoint**: Dependency available for Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared models, data, JWT/session primitives, middleware, and param validators every
user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] In `src/models/enums.ts`, add (alongside the existing `USER_ROLES`/`UserRole`, which
      this feature reuses unchanged as its `Role` type per research.md Decision 10):
      `export const SCOPES = ["users:read", "users:write", "products:read", "products:write",
      "orders:read", "orders:write", "admin"] as const;` and
      `export type Scope = (typeof SCOPES)[number];` (data-model.md).
- [X] T003 [P] Create `src/models/demoAccount.ts`: a `DemoAccount` interface — `username: string`,
      `password: string` (plaintext, per research.md Decision 2 — never echoed in any response or
      log), `role: UserRole`, `scopes: Scope[]` (data-model.md's DemoAccount table).
- [X] T004 [P] Create `src/models/authTokenClaims.ts`: `TokenKind = "valid" | "expired" | "invalid" |
      "revoked"`; `TokenType = "access" | "refresh"`; a shared `BaseTokenClaims` (`sub: string`,
      `role: UserRole`, `scopes: Scope[]`, `sid: string`, `type: TokenType`) that `AccessTokenClaims`
      (`type: "access"`) and `RefreshTokenClaims` (`type: "refresh"`) both extend (`jsonwebtoken` adds
      `iss`/`aud`/`iat`/`exp`/`jti` at sign time, so they aren't redeclared here); and
      `TokenInfoState = "valid" | "expired" | "invalid-signature" | "wrong-issuer" | "wrong-audience" |
      "wrong-token-type" | "revoked"` (data-model.md).
- [X] T005 [P] Create `src/models/session.ts`: a `Session` interface shaped as `{ id: string; sub:
      string; revoked: boolean; currentRefreshJti: string | null }` — `id` holds the same value as the
      JWT `sid` claim, named `id` specifically so this type satisfies `KeyedStore<T extends { id:
      string }>` and can reuse `createKeyedStore` as-is (data-model.md's Session table; research.md
      Decision 3).
- [X] T006 Create `src/data/demoAccounts.seed.ts` (depends on T002, T003): export a `DEMO_ACCOUNTS:
      DemoAccount[]` with exactly 4 entries, one per `UserRole` value (`user`, `admin`, `manager`,
      `readonly`), each with a unique fixed `username`/`password` and a role-appropriate default
      `scopes` set (the `admin` account's `scopes` includes `"admin"`); export
      `findDemoAccount(username: string): DemoAccount | undefined`. No reset function needed — this
      data is static seed data with no mutation lifecycle (data-model.md).
- [X] T007 Create `src/data/session.store.ts` (depends on T005): `export const sessionStore =
      createKeyedStore<Session>();` reusing the existing generic from `./keyedStore` — no new store
      type needed (research.md Decision 3).
- [X] T008 Update `tests/helpers/resetStores.ts` (depends on T007): add `sessionStore.reset([])` to
      `resetStores()` so every test file starts with a clean session store, matching the existing
      per-file `beforeEach` convention.
- [X] T009 Create `src/auth/jwt.ts` (depends on T004, `src/config`): implement `signAccessToken({sub,
      role, scopes, sid})` and `signRefreshToken({sub, role, scopes, sid})` using `jsonwebtoken.sign`
      with `config.jwtSecret`, `issuer: config.jwtIssuer`, `audience: config.jwtAudience`,
      `expiresIn: config.jwtExpiresIn` (access) or `config.jwtExpiresIn * 24` (refresh, research.md
      Decision 9 — a fixed in-code multiplier, no new env var) and a fresh `jti` (`crypto.randomUUID()`)
      per call; `decodeToken(token)` wrapping `jwt.decode(token, { complete: true })` (returns `null` on
      structural failure, used by `token-info`'s 400 check per research.md Decision 6);
      `verifyToken(token, expectedType: TokenType)` that calls `jwt.verify(token, config.jwtSecret,
      { issuer: config.jwtIssuer, audience: config.jwtAudience })` and returns a discriminated result —
      `{ ok: true, claims }` on success (after also checking `claims.type === expectedType`, else
      `{ ok: false, reason: "wrong-token-type" }`) or `{ ok: false, reason }` where `reason` is
      `"expired"` (caught `TokenExpiredError`), `"wrong-issuer"` / `"wrong-audience"` (JsonWebTokenError
      messages containing `"issuer"` / `"audience"`), or `"invalid-signature"` (any other
      `JsonWebTokenError`) — this is the FR-006/FR-014 reason classification; also implement
      `corruptSignature(token: string): string` (flips one character in the token's third,
      dot-separated segment) for the `invalid` convenience-kind (research.md Decision 7).
- [X] T010 [P] Create `src/auth/scopes.ts` (depends on T002): `hasScope(tokenScopes: Scope[], required:
      Scope): boolean` returning `tokenScopes.includes(required) || tokenScopes.includes("admin")`
      (FR-009; the `admin` scope satisfies every check).
- [X] T011 Create `src/middleware/authenticate.ts` (depends on T009, T007): export an `AuthContext`
      type (`{ sub: string; role: UserRole; scopes: Scope[]; sid: string }`) and augment Express via
      `declare global { namespace Express { interface Request { auth?: AuthContext } } }` (this
      feature's first use of custom `Request` augmentation — no existing pattern to follow beyond
      `requestId.ts`'s narrower `req.id` case). The `authenticate` middleware: extracts the token from
      `Authorization: Bearer <token>` (missing header, wrong scheme, empty token, or a duplicate header
      → `401` `"malformed Authorization header"`, per the Edge Cases section); calls
      `verifyToken(token, "access")`; on failure, `401` with `error.message` naming the specific
      `reason` (FR-014); on success, looks up `sessionStore.get(claims.sid)` — missing or
      `session.revoked === true` → `401` `"revoked"`; otherwise sets `req.auth = { sub: claims.sub,
      role: claims.role, scopes: claims.scopes, sid: claims.sid }` and calls `next()`.
- [X] T012 [P] Create `src/middleware/requireRole.ts` (depends on T011's `AuthContext`):
      `requireRole(role: UserRole)` returns an Express middleware that responds `403` (`error.code`
      `"FORBIDDEN"`) when `req.auth!.role !== role`, else `next()` (FR-007/FR-008, FR-015).
- [X] T013 [P] Create `src/middleware/requireScope.ts` (depends on T010, T011's `AuthContext`):
      `requireScope(scope: Scope)` returns an Express middleware that responds `403` with `error.code`
      `"INSUFFICIENT_SCOPE"` and the missing scope named in `error.details` when
      `!hasScope(req.auth!.scopes, scope)`, else `next()` (FR-009, FR-015, spec User Story 4 acceptance
      scenario 2).
- [X] T014 [P] Create `src/utils/roleParam.ts`: `parseRoleParam(raw: string): UserRole`, a
      parse-or-throw function following the existing `idParam.ts`/`slugParam.ts` style — throws
      `HttpError(400, "VALIDATION_ERROR", ...)` when `raw` is not exactly one of `USER_ROLES` (FR-008's
      `400` case for `GET /api/v1/role/{role}`).
- [X] T015 [P] Create `src/utils/scopeParam.ts`: `parseScopeParam(raw: string): Scope`, same
      parse-or-throw style against `SCOPES` (FR-009's `400` case for `GET /api/v1/scope/{scope}`,
      mirroring T014).

**Checkpoint**: Foundational ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Log In, Establish Identity, Log Out (Priority: P1) 🎯 MVP

**Goal**: The foundational session lifecycle — login, identity check, refresh rotation, logout — every
other authenticated scenario in this project builds on.

**Independent Test**: `POST /auth/login` with a valid demo credential → `GET /auth/me` with the
returned access token confirms identity → `POST /auth/logout` → the same token is subsequently
rejected. See quickstart.md Scenario 1.

### Tests for User Story 1

> **NOTE**: Write these tests FIRST, ensure they FAIL before implementation.

- [X] T016 [P] [US1] Create `tests/auth.test.ts` covering (per spec.md User Story 1's acceptance
      scenarios 1-6 and the Edge Cases section): login with a valid demo credential → `200` with
      `accessToken`, `refreshToken`, `tokenType`, `expiresIn`; login with a wrong password → `401`;
      login with an unknown username → `401` with the *same* error shape as wrong-password (edge
      case: never reveal whether the username exists); login with a missing/wrong-typed body field →
      `400`; `GET /auth/me` with the access token → `200` with `sub`/`role`/`scopes`; `GET /auth/me`
      with no token → `401`; `POST /auth/refresh` with the refresh token → `200` with a new
      access+refresh pair; re-using the *original* (now-rotated-away) refresh token → `401` (FR-003,
      acceptance scenario 6); presenting a refresh token to an endpoint expecting an access token (or
      vice versa) → `401` `"wrong-token-type"` (FR-012); `POST /auth/logout` with the access token →
      `200`, then the same token on `GET /auth/me` → `401` `"revoked"`; logging out a *second* time
      with that same now-revoked token → `200` again (idempotent, per the Edge Cases section); logout
      with a token that was never valid (garbage string) → `401`.

### Implementation for User Story 1

- [X] T017 [US1] Create `src/models/authRequests.ts` with `loginRequestSchema` (zod: `username:
      z.string().min(1)`, `password: z.string().min(1)`, `.strict()`) and `refreshRequestSchema`
      (`refreshToken: z.string().min(1)`, `.strict()`), following the existing
      `models/user.ts`-style co-located zod schema convention.
- [X] T018 [US1] Create `src/services/auth.service.ts` (depends on T006, T007, T009, T017):
      `login(body)` — `loginRequestSchema.parse(body)`, look up `findDemoAccount(username)`, compare
      `password` directly (plaintext, Decision 2), throw `HttpError(401, "UNAUTHORIZED", ...)` on any
      mismatch (same message for unknown-username and wrong-password); on success, create a new
      `Session` (`sessionStore.create({ id: randomUUID(), sub: username, revoked: false,
      currentRefreshJti: <refresh token's jti> })`), sign an access+refresh pair, return
      `{ accessToken, refreshToken, tokenType: "Bearer", expiresIn: config.jwtExpiresIn }`.
      `getMe(auth: AuthContext)` — returns `{ sub: auth.sub, role: auth.role, scopes: auth.scopes }`.
      `logout(token: string)` — verifies signature/expiry/issuer/audience/type via `verifyToken(token,
      "access")` *without* checking `session.revoked` (research.md Decision 5); any verification
      failure → `401`; on success, `sessionStore.replace(claims.sid, s => ({...s, revoked: true}))` (a
      no-op if already revoked) and return. `refresh(body)` — `refreshRequestSchema.parse(body)`,
      `verifyToken(refreshToken, "refresh")` (401 on any failure), look up the session; `401` if
      missing/revoked or if `claims.jti !== session.currentRefreshJti` (stale/replayed, FR-003
      acceptance scenario 6, research.md Decision 4); on success, sign a new access+refresh pair
      under the *same* `sid`, update `session.currentRefreshJti` to the new refresh token's `jti`,
      return the new pair.
- [X] T019 [US1] Create `src/controllers/auth.controller.ts` (depends on T018): thin handlers —
      `login(req, res)` → `res.status(200).json(authService.login(req.body))`; `logout(req, res)` →
      extract the Bearer token (reuse the same header-parsing helper `authenticate.ts` uses; export it
      from `src/auth/jwt.ts` or `src/middleware/authenticate.ts` so it isn't duplicated), call
      `authService.logout(token)`, `res.status(200).json({})`; `refresh(req, res)` → `res.status(200)
      .json(authService.refresh(req.body))`; `getMe(req, res)` → `res.status(200)
      .json(authService.getMe(req.auth!))`.
- [X] T020 [US1] Create `src/routes/auth.routes.ts` (depends on T019, T011): `export const authRouter =
      Router({ strict: true });` mount `POST /auth/login` (no middleware), `POST /auth/logout`
      (**no** `authenticate` middleware — the controller/service perform their own
      non-revocation-gated verification per research.md Decision 5, so an already-revoked token
      still reaches the handler and gets an idempotent `200` instead of being rejected by
      `authenticate`), `POST /auth/refresh` (no middleware — the refresh token itself is the
      credential), `GET /auth/me` (`authenticate`); add `methodNotAllowedHandler` for each path,
      following the existing `search.routes.ts` style.
- [X] T021 [US1] Wire `authRouter` into `src/app.ts` (depends on T020): mount it top-level (alongside
      `healthRouter`/`versionRouter`, *not* under `apiRouter`), matching CLAUDE.md's `/auth/*` path
      spelling (no `/api/v1` prefix).

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md Scenario 1).

---

## Phase 4: User Story 2 - Issue and Inspect Purpose-Built Tokens for Automated Testing (Priority: P2)

**Goal**: On-demand, reproducible tokens in every failure state (valid/expired/invalid/revoked),
without a real login or waiting on wall-clock time, plus a way to decode/diagnose any token.

**Independent Test**: `POST /auth/token` for each of the 4 `kind` values, then confirm both
`GET /auth/token-info`'s reported `state` and `GET /api/v1/protected`'s accept/reject behavior for each.
See quickstart.md Scenario 2.

### Tests for User Story 2

- [X] T022 [P] [US2] Create `tests/authToken.test.ts` covering (per spec.md User Story 2's acceptance
      scenarios 1-6): `POST /auth/token` with `kind: "valid"` for a chosen `role`/`scopes` → `200` with
      an `accessToken` whose decoded claims (via `token-info`) carry exactly that role/scopes;
      `kind: "expired"` → the token's `token-info` state is `"expired"`, and it is rejected `401` by
      `GET /api/v1/protected`; `kind: "invalid"` → `token-info` state `"invalid-signature"`, rejected
      `401`; `kind: "revoked"` → `token-info` state `"revoked"`, rejected `401`; an unknown `role`,
      an unknown `scopes` entry, or an unknown `kind` in the request body → `400`/`422`; a malformed
      or empty token on `GET /auth/token-info` → `400` (acceptance scenario 6) rather than a decoded
      state.

### Implementation for User Story 2

- [X] T023 [US2] Extend `src/models/authRequests.ts` (depends on T017) with `tokenIssueRequestSchema`
      (zod: `role: z.enum(USER_ROLES)`, `scopes: z.array(z.enum(SCOPES))`, `kind: z.enum(["valid",
      "expired", "invalid", "revoked"])`, `.strict()`).
- [X] T024 [US2] Extend `src/services/auth.service.ts` (depends on T018, T009, T023) with
      `issueConvenienceToken(body)` — `tokenIssueRequestSchema.parse(body)`; create a new `Session`
      (`revoked: kind === "revoked"`, `currentRefreshJti: null` — this endpoint issues access tokens
      only, no refresh pairing); sign an access token per `kind` per research.md Decision 7 (`valid`:
      normal `signAccessToken`; `expired`: sign with an already-elapsed expiry; `invalid`: sign
      normally then `corruptSignature(...)`; `revoked`: sign normally, session already marked
      revoked above); return `{ accessToken, tokenType: "Bearer", kind }`. And `getTokenInfo(token:
      string)` — `decodeToken(token)`; `null` → throw `HttpError(400, "VALIDATION_ERROR", "malformed
      token")` (FR-016); otherwise call `verifyToken(token, "access")` and, on success, also check
      `sessionStore.get(claims.sid)?.revoked` — return `{ state: <valid|expired|invalid-signature|
      wrong-issuer|wrong-audience|wrong-token-type|revoked>, claims: decoded.payload }` always as a
      `200`-shaped result (research.md Decision 6 — never gated by `authenticate`).
- [X] T025 [US2] Extend `src/controllers/auth.controller.ts` (depends on T024) with `issueToken(req,
      res)` → `res.status(200).json(authService.issueConvenienceToken(req.body))` and `getTokenInfo(req,
      res)` → extract the Bearer token (400 if missing/empty, per T024), `res.status(200)
      .json(authService.getTokenInfo(token))`.
- [X] T026 [US2] Extend `src/routes/auth.routes.ts` (depends on T025) with `POST /auth/token` (no
      middleware — unauthenticated by design, per spec.md's Clarifications session) and
      `GET /auth/token-info` (no `authenticate` middleware — reads the header directly in the
      controller, research.md Decision 6).

**Checkpoint**: User Stories 1 AND 2 both work independently (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Demonstrate 401 vs 403 and Role-Gated Access (Priority: P3)

**Goal**: One unambiguous place to confirm 401-vs-403 semantics, plus per-role enforcement across all
four documented roles.

**Independent Test**: `GET /api/v1/protected` with no token (401), a wrong-role token (403), and a
correct-role token (200); `GET /api/v1/role/{role}` for every role×role combination. See quickstart.md
Scenario 3.

### Tests for User Story 3

- [X] T027 [P] [US3] Create `tests/protected.test.ts` covering spec.md User Story 3 acceptance
      scenarios 1-4: no `Authorization` header → `401`; an expired, invalid-signature, or revoked
      token → `401` with a message naming that specific reason (not a generic one); a valid token
      whose role is not `admin` → `403`; a valid `admin`-role token → `200` with a body confirming
      `granted: true` and the role (research.md Decision 8 — this endpoint's required role is fixed to
      `admin`).
- [X] T028 [P] [US3] Create `tests/roles.test.ts` covering acceptance scenarios 5-7: for each of the 4
      roles, a token holding that role against `GET /api/v1/role/{same-role}` → `200`; that same token
      against each of the other 3 roles' endpoints → `403` (the full 4×4 matrix); `GET
      /api/v1/role/superadmin` (not one of the 4 documented roles) → `400`, not a false `403`/`404`.

### Implementation for User Story 3

- [X] T029 [US3] Create `src/controllers/protected.controller.ts`: `getProtected(req, res)` →
      `res.status(200).json({ granted: true, role: req.auth!.role })`.
- [X] T030 [US3] Create `src/routes/protected.routes.ts` (depends on T029, T011, T012): `export const
      protectedRouter = Router({ strict: true });` mount `GET /api/v1/protected` with `authenticate,
      requireRole("admin")` (research.md Decision 8); `methodNotAllowedHandler` for other methods.
- [X] T031 [US3] Create `src/controllers/role.controller.ts`: `getRoleDemo(req, res)` →
      `res.status(200).json({ role: req.params.role, granted: true })` (reachable only after the
      route's own role check passes, so `granted` is always `true` here — the `403` case never reaches
      this handler).
- [X] T032 [US3] Create `src/routes/role.routes.ts` (depends on T031, T014, T011, T012): `GET
      /api/v1/role/:role` — first validates `:role` via `parseRoleParam` (400 on failure), then applies
      `authenticate` and a *dynamically parameterized* `requireRole(parsedRole)` before calling
      `getRoleDemo` (the required role is the path value itself, per spec.md FR-008).
- [X] T033 [US3] Wire `protectedRouter` and `roleRouter` into `apiRouter` in `src/app.ts` (depends on
      T030, T032) — both mount under the existing `config.apiPrefix`-scoped router, matching
      `/api/v1/protected` and `/api/v1/role/{role}`'s documented prefix.

**Checkpoint**: User Stories 1, 2, AND 3 all work independently (quickstart.md Scenario 3).

---

## Phase 6: User Story 4 - Demonstrate Scope-Based Authorization (Priority: P4)

**Goal**: OAuth-style scope enforcement, independent of role, with the `admin` scope satisfying any
check.

**Independent Test**: Tokens with different scope combinations against `GET /api/v1/scope/{scope}` for
each of the 7 documented scopes. See quickstart.md Scenario 4.

### Tests for User Story 4

- [X] T034 [P] [US4] Create `tests/scopes.test.ts` covering spec.md User Story 4 acceptance scenarios
      1-4: a token carrying the exact required scope → `200`; a token missing it → `403` with
      `error.code === "INSUFFICIENT_SCOPE"` naming the missing scope; a token carrying `admin` →
      `200` against *every* scope-demo endpoint regardless of the path's specific scope; a token
      carrying multiple scopes → `200` against any one of them; `GET /api/v1/scope/not-a-real-scope`
      → `400`.

### Implementation for User Story 4

- [X] T035 [US4] Create `src/controllers/scope.controller.ts`: `getScopeDemo(req, res)` →
      `res.status(200).json({ scope: req.params.scope, granted: true })` (analogous to
      `role.controller.ts`).
- [X] T036 [US4] Create `src/routes/scope.routes.ts` (depends on T035, T015, T011, T013): `GET
      /api/v1/scope/:scope` — validates `:scope` via `parseScopeParam` (400 on failure), then applies
      `authenticate` and a dynamically parameterized `requireScope(parsedScope)` before calling
      `getScopeDemo` (FR-009).
- [X] T037 [US4] Wire `scopeRouter` into `apiRouter` in `src/app.ts` (depends on T036).

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [X] T038 [P] Merge `contracts/jwt-auth-roles-scopes.openapi.yaml`'s `tags`, `paths`,
      `components.securitySchemes.bearerAuth`, `components.schemas`, and `components.responses`
      (`Unauthorized`, `Forbidden`) into the root `openapi.yaml`, so `/docs`, `/openapi.json`, and
      `/openapi.yaml` document exactly the 9 operations this spec implements (constitution: Quality
      Gates & Spec Parity).
- [X] T039 Run `npm test` and confirm the full suite — Specs 001-004's existing tests plus
      `tests/auth.test.ts`, `tests/authToken.test.ts`, `tests/protected.test.ts`, `tests/roles.test.ts`,
      and `tests/scopes.test.ts` — passes.
- [X] T040 Execute the manual validation scenarios in `specs/005-jwt-auth-roles-scopes/quickstart.md`
      against a running `npm run dev` server and confirm every expected status code and state.
- [X] T041 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, `/openapi.yaml`, and
      `GET /api/v1/routes` render/list all 9 new endpoints correctly (including their auth
      requirement), with no schema errors. Note: `GET /api/v1/routes` itself is not yet implemented
      in this codebase (it is Spec 012's deliverable per the roadmap) — verified instead that
      `/openapi.json` lists exactly the 9 documented paths and every `$ref` in them resolves, and
      that `/docs`/`/openapi.yaml` serve successfully.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001, for `jsonwebtoken`). BLOCKS all user stories.
  T002-T005 (models) can run in parallel; T006 depends on T002+T003; T007 depends on T005; T008 depends
  on T007; T009 depends on T004; T010 depends on T002; T011 depends on T009+T007; T012/T013 depend on
  T011 (and T010 for T013); T014/T015 are independent of everything except the existing `USER_ROLES`/new
  `SCOPES`.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Delivers the session lifecycle every
  later story's tokens are exercised against.
- **User Story 2 (Phase 4)**: Depends on Foundational, and extends US1's `authRequests.ts` (T017) and
  `auth.service.ts`/`auth.controller.ts`/`auth.routes.ts` (T018-T020) — sequential with US1 on those
  shared files, but independently testable once its own tasks land.
- **User Story 3 (Phase 5)**: Depends on Foundational only (`authenticate`, `requireRole`,
  `roleParam`) — independent of US1/US2's files, may proceed in parallel with US2.
- **User Story 4 (Phase 6)**: Depends on Foundational only (`authenticate`, `requireScope`,
  `scopeParam`) — independent of US1/US2/US3's files, may proceed in parallel with either.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- US1: models → service → controller → routes → `app.ts` wiring, in that order; tests target the
  finished route.
- US2: extends US1's shared files in the same order (schema → service → controller → routes).
- US3 and US4: controller → routes → `app.ts` wiring, each independent of the other.

### Parallel Opportunities

- T002-T005 (Foundational models) run in parallel — different files, no cross-dependencies.
- T012 and T013 run in parallel once T011 exists.
- T014 and T015 run in parallel at any point after Foundational starts.
- Once Foundational completes, US3 (Phase 5) and US4 (Phase 6) can proceed fully in parallel with each
  other and with US2 (Phase 4), since none share a file; US2 must follow US1 sequentially only because
  it extends the same `authRequests.ts`/`auth.service.ts`/`auth.controller.ts`/`auth.routes.ts` files.
- T038 and T041 (Polish) run in parallel; T039 and T040 are sequential whole-suite/manual checks.

---

## Parallel Example: Foundational

```bash
# After T001 (dependency) lands, launch the four model files together:
Task: "Add SCOPES/Scope to src/models/enums.ts"
Task: "Create src/models/demoAccount.ts"
Task: "Create src/models/authTokenClaims.ts"
Task: "Create src/models/session.ts"
```

## Parallel Example: User Stories 3 & 4

```bash
# Once Foundational is done, these two stories touch entirely different files:
Task: "Implement GET /api/v1/protected and GET /api/v1/role/{role} (User Story 3)"
Task: "Implement GET /api/v1/scope/{scope} (User Story 4)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (login/me/refresh/logout, full test coverage).
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 independently.
5. Deploy/demo if ready — this alone satisfies CLAUDE.md's chained-workflow entry point
   (`login → /auth/me → ...`).

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → test independently → deploy/demo (MVP!).
3. Add User Story 2 → test independently → deploy/demo.
4. Add User Story 3 → test independently → deploy/demo.
5. Add User Story 4 → test independently → deploy/demo.
6. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple developers, after Foundational lands: Developer A takes US1 → US2 (sequential, shared
files); Developer B takes US3; Developer C takes US4 — B and C can start immediately in parallel with A
and each other.
