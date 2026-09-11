# Implementation Plan: JWT Authentication, Roles & Scopes

**Branch**: `005-jwt-auth-roles-scopes` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-jwt-auth-roles-scopes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver the project's primary auth mechanism: `POST /auth/login`, `/auth/logout`, `/auth/refresh`,
`GET /auth/me`, `POST /auth/token`, `GET /auth/token-info` for session lifecycle and test-convenience
token issuance, plus `GET /api/v1/protected` (401-vs-403 demo), `GET /api/v1/role/{role}`, and
`GET /api/v1/scope/{scope}` for role/scope enforcement demos. Technical approach: signed JWTs via the
`jsonwebtoken` library (access + refresh, both carrying a session id `sid` and a `type` discriminator),
a tiny in-memory session store keyed by `sid` for O(1) revocation/rotation checks, a fixed 4-account demo
credential set (one per role, owned by this feature — independent of the Spec 002 `users` resource), and
two dedicated middlewares (`authenticate` for enforcing endpoints, and a non-gating decode-and-diagnose
path used only by `GET /auth/token-info` so it can report on tokens it would otherwise reject). No new
environment variables — `JWT_SECRET/ISSUER/AUDIENCE/EXPIRES_IN` and `ADMIN_TOKEN` already exist in
config from Spec 001. See [research.md](research.md) for full rationale on every non-obvious decision.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-004

**Primary Dependencies**: Express 4.x, `zod` (request validation, already a dependency) — plus one new
dependency, `jsonwebtoken` (+ `@types/jsonwebtoken`), for HS256 JWT signing/verification with
issuer/audience/expiry semantics (see research.md Decision 1 for why a hand-rolled signer was rejected)

**Storage**: N/A persistent — two new in-memory stores following the existing `keyedStore.ts` pattern:
a `Session` store (keyed by `sid`) for revocation/rotation state, and a fixed, non-mutable demo-account
list (no CRUD lifecycle, just lookup)

**Testing**: Vitest + Supertest — unchanged from Specs 001-004; `tests/helpers/resetStores.ts` gains a
call to reset the new session store between tests, matching the existing per-file `beforeEach` convention

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for
external testing tools (k6, Postman, contract-test suites) — this is the auth flow CLAUDE.md's own
chained-workflow example starts with (`login → /auth/me → ...`)

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged from Specs 001-004

**Performance Goals**: Token issuance/verification is bounded HMAC-SHA256 signing/verification plus O(1)
in-memory lookups — sub-millisecond handler work, no I/O, well within the constitution's bounded-resource
principle even under sustained load-test traffic (a chained k6 flow calls `/auth/login` once per
virtual-user iteration)

**Constraints**: No unbounded memory growth (the session store only ever holds one record per active
login/refresh/convenience-token session — bounded by the process's request volume, not by user input);
no external network calls; fully deterministic given the same config and inputs aside from real
wall-clock expiry (constitution Principle II); secrets (JWT_SECRET, demo passwords, full token values)
never logged or echoed (constitution Principle IV, FR-019)

**Scale/Scope**: This spec only — 4 fixed demo accounts, 7 documented scopes, 4 documented roles, 9
endpoints total; depends only on Spec 001's foundation (config, error envelope, request-id middleware,
logging) and is independently buildable/testable in parallel with Specs 003/004/006 per the roadmap

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds the project's primary auth mechanism plus dedicated convenience-token issuance for every documented failure mode (expired/invalid/revoked) — pure surface expansion for testing tools; nothing narrowed. |
| II. Determinism & Reproducibility | PASS | Given the same config, the same login credentials or `/auth/token` request always produces a token with the same claims shape; only real wall-clock expiry varies, and that variation is itself the deliberately configurable `expired`/`valid` convenience-kind distinction, not incidental randomness. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every auth/authz failure path (missing/malformed/expired/invalid-signature/wrong-issuer/wrong-audience/revoked/insufficient-scope/insufficient-role) resolves to a structured `401`/`403`/`400` via the existing `HttpError`/`ErrorEnvelope`/`X-Request-ID` machinery — no new error shape introduced. |
| IV. Secret & Credential Hygiene | PASS | `JWT_SECRET` is sourced from existing config, never hardcoded; demo account passwords and full token values are never logged (existing `logger.ts` redact list is extended) or echoed back in any response body. |
| V. Bounded Resource Usage Under Load | PASS | Token operations are O(1) HMAC signing/verification plus a single in-memory map lookup — no external calls, no unbounded allocation; the session store's size is bounded by request volume, not by any caller-controlled input (constitution requires bounding *caller-supplied* values, not naturally-bounded server-side state). |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New code follows the existing `routes/controllers/services/models/data/middleware/utils` split, adds a new `src/auth/` module (already reserved by CLAUDE.md's project structure for "JWT, API key, basic-auth logic") for JWT-specific logic; `/auth/*` endpoints are mounted top-level (matching CLAUDE.md's own path spelling, not `/api/v1/auth/*`), while `/api/v1/protected`, `/api/v1/role/{role}`, `/api/v1/scope/{scope}` mount under the existing `apiRouter`. |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly the paths/schemas/securityScheme in `contracts/jwt-auth-roles-scopes.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-jwt-auth-roles-scopes/
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
├── app.ts                            # existing; gains authRouter (top-level) + protected/role/scope routes (under apiRouter)
├── config/
│   └── index.ts                      # existing; jwtSecret/jwtIssuer/jwtAudience/jwtExpiresIn/adminToken already present, reused as-is
├── models/
│   ├── enums.ts                      # existing; gains SCOPES/Scope (USER_ROLES/UserRole already present and reused for Role)
│   ├── demoAccount.ts                # NEW: DemoAccount type
│   ├── authTokenClaims.ts            # NEW: AccessTokenClaims, RefreshTokenClaims, TokenKind, TokenInfoState types
│   └── session.ts                    # NEW: Session record type
├── data/
│   ├── demoAccounts.seed.ts          # NEW: the 4 fixed demo accounts (one per role)
│   └── session.store.ts              # NEW: in-memory Map<sid, Session>, following the existing keyedStore.ts pattern
├── auth/
│   ├── jwt.ts                        # NEW: sign/verify/decode helpers wrapping jsonwebtoken; classifies verify failures into the FR-006/FR-014 reason set
│   └── scopes.ts                     # NEW: SCOPES list + hasScope(tokenScopes, required) helper (admin scope satisfies any check)
├── middleware/
│   ├── authenticate.ts               # NEW: extracts+verifies Bearer access token, 401 with specific reason on any failure, attaches req.auth
│   ├── requireRole.ts                # NEW: 403 (ROLE not permitted) if req.auth.role doesn't match
│   └── requireScope.ts               # NEW: 403 INSUFFICIENT_SCOPE if req.auth doesn't carry the required scope (or admin)
├── services/
│   └── auth.service.ts               # NEW: login/logout/refresh/issueConvenienceToken/tokenInfo business logic
├── controllers/
│   ├── auth.controller.ts            # NEW: login, logout, refresh, me, token, tokenInfo handlers
│   ├── protected.controller.ts       # NEW: GET /api/v1/protected handler
│   ├── role.controller.ts            # NEW: GET /api/v1/role/:role handler
│   └── scope.controller.ts           # NEW: GET /api/v1/scope/:scope handler
├── routes/
│   ├── auth.routes.ts                # NEW: /auth/login, /auth/logout, /auth/refresh, /auth/me, /auth/token, /auth/token-info (top-level)
│   ├── protected.routes.ts           # NEW: GET /api/v1/protected
│   ├── role.routes.ts                # NEW: GET /api/v1/role/:role
│   └── scope.routes.ts               # NEW: GET /api/v1/scope/:scope
└── utils/
    ├── logger.ts                     # existing; redact list extended to cover request bodies' `password`/token fields
    ├── roleParam.ts                  # NEW: validates :role against USER_ROLES, else 400 (mirrors idParam.ts's parse-or-400 style)
    └── scopeParam.ts                 # NEW: validates :scope against SCOPES, else 400

tests/
├── helpers/
│   └── resetStores.ts                # existing; gains a session-store reset call
├── auth.test.ts                      # NEW: login/logout/refresh/me lifecycle, credential failure, refresh replay
├── authToken.test.ts                 # NEW: POST /auth/token + GET /auth/token-info, all 4 kinds × validity-state matrix
├── protected.test.ts                 # NEW: 401 vs 403 vs 200 matrix on GET /api/v1/protected
├── roles.test.ts                     # NEW: GET /api/v1/role/:role — all 4×4 role combinations + invalid role
└── scopes.test.ts                    # NEW: GET /api/v1/scope/:scope — all 7 scopes, admin-override, missing-scope

openapi.yaml                          # existing; gains the paths/schemas/securityScheme from contracts/jwt-auth-roles-scopes.openapi.yaml
package.json                          # gains jsonwebtoken + @types/jsonwebtoken
```

**Structure Decision**: Extends the existing Specs 001-004 single-backend-project layout. Introduces one
new top-level module, `src/auth/`, exactly matching the directory CLAUDE.md's project structure already
reserves for "JWT, API key, basic-auth logic" (Spec 006 will add its own files alongside these, not
replace them). Every other new file follows the established one-concern-per-layer convention
(`routes/controllers/services/models/data/middleware/utils`). No changes to any Spec 002/003/004 file —
this feature has no dependency on those resources and touches none of their code, preserving the
roadmap's parallelizability.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS. `data-model.md` introduces exactly
one new mutable in-memory store (`Session`, keyed by `sid`) whose size is bounded by request volume and
which is fully reset by `tests/helpers/resetStores.ts` between tests, preserving Principle II's
determinism guarantee. `contracts/jwt-auth-roles-scopes.openapi.yaml` documents exactly the 9 operations
and one `bearerAuth` security scheme this spec implements, reusing the root document's `Error` schema
and adding `Unauthorized`/`Forbidden` reusable responses for later specs to reuse rather than duplicating
per-operation. The quickstart's full login→me→logout, convenience-token validity-state matrix, and
role/scope 401-vs-403 walkthroughs directly exercise Principles II, III, and IV (no secret ever appears
in a captured response). No new violations introduced during design; Complexity Tracking remains empty.
