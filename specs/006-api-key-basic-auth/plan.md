# Implementation Plan: API Key & Basic Auth

**Branch**: `006-api-key-basic-auth` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-api-key-basic-auth/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver the project's two secondary auth mechanisms, independent of the JWT flow (Spec 005):
API keys (`POST /auth/api-key` to issue, `POST /auth/api-key/revoke` to revoke, `GET
/api-key/protected` to exercise) and HTTP Basic Auth (`GET /auth-test/basic`). Technical approach:
an opaque, high-entropy API key value doubles as its own lookup key in a new in-memory keyed
store (mirroring Spec 005's `Session`-keyed-by-`sid` trick), a `kind` convenience parameter
(`valid`/`expired`/`revoked`) mirroring `POST /auth/token`'s pattern for deterministic test
states, two new lightweight middlewares (`apiKeyAuth`, `basicAuth`), and one fixed, feature-owned
Basic Auth demo credential (no new env vars — CLAUDE.md's `.env.example` gains none). See
[research.md](research.md) for full rationale on every non-obvious decision.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-005

**Primary Dependencies**: Express 4.x, `zod` (request validation) — no new dependency. API key
generation uses Node's built-in `node:crypto` (`randomBytes`), the same module Spec 005 already
uses for `randomUUID()`; Basic Auth decoding uses Node's built-in `Buffer` (base64), no library
needed.

**Storage**: N/A persistent — one new in-memory store following the existing
`createKeyedStore`/`keyedStore.ts` pattern: an `ApiKey` store keyed by the raw key value itself
(research.md Decision 1), plus one fixed, non-mutable Basic Auth demo credential constant (no
store, no lifecycle — a single record, not a list).

**Testing**: Vitest + Supertest — unchanged; `tests/helpers/resetStores.ts` gains a call to reset
the new API key store between tests, matching the existing per-file convention.

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for
external testing tools — unchanged from Specs 001-005.

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged.

**Performance Goals**: API key issuance is one `crypto.randomBytes` call plus an O(1) map insert;
verification/revocation are O(1) map lookups. Basic Auth verification is one base64 decode plus a
constant-count string comparison against the single fixed demo credential. Sub-millisecond
handler work, no I/O, well within the constitution's bounded-resource principle even under
sustained load-test traffic.

**Constraints**: No unbounded memory growth (the API key store holds one record per issued key —
bounded by request volume, not by caller-supplied input); no external network calls; fully
deterministic given the same inputs — a `kind: valid` key never expires (per the Clarifications
session), so there is no wall-clock-dependent variability anywhere in this feature, unlike Spec
005's real-time JWT expiry; secrets (API key values, the Basic Auth demo password) never logged
or echoed (constitution Principle IV, FR-015).

**Scale/Scope**: This spec only — 1 seeded Basic Auth demo credential, 4 endpoints total (`POST
/auth/api-key`, `POST /auth/api-key/revoke`, `GET /api-key/protected`, `GET /auth-test/basic`);
depends only on Spec 001's foundation (config, error envelope, request-id middleware, logging)
and is independently buildable/testable in parallel with Specs 003/004/005 per the roadmap — it
adds files alongside Spec 005's `src/auth/` module without touching any of Spec 005's code.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds two secondary, independently-testable auth mechanisms with dedicated convenience-issuance (`kind`) and revocation, expanding the auth-mechanism surface for testing tools; nothing narrowed. |
| II. Determinism & Reproducibility | PASS | Given the same inputs, `POST /auth/api-key` with a given `kind` always produces the same status/expiry shape; `kind: valid` never expires (Clarifications session), so there is no real-wall-clock variability at all in this feature — stricter determinism than Spec 005's JWT flow, which does have real access-token expiry. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every API-key failure (missing/unrecognized/expired/revoked) and every Basic Auth failure (missing/malformed/wrong-credential) resolves to a structured `401` via the existing `HttpError`/`ErrorEnvelope`/`X-Request-ID` machinery; revoking an unknown key resolves to the existing `RESOURCE_NOT_FOUND` `404` convention. No new error shape introduced. |
| IV. Secret & Credential Hygiene | PASS | The Basic Auth demo password and every API key value are never logged (existing `logger.ts` redact list is extended to cover the `X-API-Key` request header) or echoed back except in `POST /auth/api-key`'s own one-time issuance response. |
| V. Bounded Resource Usage Under Load | PASS | API key issuance/verification/revocation are O(1) crypto + map operations — no external calls, no unbounded allocation; the API key store's size is bounded by request volume, not by caller-controlled input. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New code follows the existing `routes/controllers/services/models/data/middleware/utils` split, adding files to the existing `src/auth/` module (already reserved by CLAUDE.md's project structure for "JWT, API key, basic-auth logic" and already used by Spec 005) rather than a new top-level directory. `/auth/api-key*` and `/api-key/protected`/`/auth-test/basic` mount top-level (outside `/api/v1`), matching CLAUDE.md's own path spelling exactly as Spec 005 did for `/auth/*`. |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly the paths/schemas/securityScheme in `contracts/api-key-basic-auth.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/006-api-key-basic-auth/
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
├── app.ts                            # existing; gains apiKeyRouter + basicAuthRouter (both top-level, alongside authRouter)
├── models/
│   └── apiKey.ts                     # NEW: ApiKey record type, API_KEY_KINDS/ApiKeyKind, ApiKeyStatus
├── data/
│   ├── apiKey.store.ts               # NEW: in-memory keyed store, following session.store.ts's pattern
│   └── basicAuthAccount.seed.ts      # NEW: the single fixed Basic Auth demo credential
├── auth/
│   ├── apiKey.ts                     # NEW: generateApiKey() (opaque, unguessable), computeStatus(key) helper
│   └── basicAuth.ts                  # NEW: parses/decodes an `Authorization: Basic ...` header; never throws
├── middleware/
│   ├── apiKeyAuth.ts                 # NEW: extracts+verifies X-API-Key, 401 with specific reason on any failure, attaches req.apiKey
│   └── basicAuth.ts                  # NEW: verifies HTTP Basic credentials against the single demo account, 401 with specific reason
├── services/
│   └── apiKey.service.ts             # NEW: issue/revoke/verify business logic
├── controllers/
│   ├── apiKey.controller.ts          # NEW: issueApiKey, revokeApiKey, getApiKeyProtected handlers
│   └── basicAuth.controller.ts       # NEW: getBasicAuthProtected handler
├── routes/
│   ├── apiKey.routes.ts              # NEW: POST /auth/api-key, POST /auth/api-key/revoke, GET /api-key/protected (all top-level)
│   └── basicAuth.routes.ts           # NEW: GET /auth-test/basic (top-level)
└── utils/
    └── logger.ts                     # existing; redact list extended to cover req.headers['x-api-key']

tests/
├── helpers/
│   └── resetStores.ts                # existing; gains an apiKeyStore reset call
├── apiKey.test.ts                    # NEW: issue/use/revoke lifecycle, all kind values, all failure reasons
└── basicAuth.test.ts                 # NEW: valid/wrong-password/unknown-username/missing/malformed-header matrix

openapi.yaml                          # existing; gains the paths/schemas/securityScheme from contracts/api-key-basic-auth.openapi.yaml
```

**Structure Decision**: Extends the existing Specs 001-005 single-backend-project layout. Adds
files to the `src/auth/` module Spec 005 already established (no new top-level directory), and
otherwise follows the established one-concern-per-layer convention
(`routes/controllers/services/models/data/middleware/utils`). No changes to any Spec 002/003/004
file, and no changes to any Spec 005 file — this feature has no dependency on those resources or
on the JWT session/demo-account machinery, preserving the roadmap's parallelizability. The only
shared files touched are `src/app.ts` (route mounting), `src/utils/logger.ts` (redact-list
extension), `tests/helpers/resetStores.ts` (store reset), and the root `openapi.yaml`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS. `data-model.md` introduces
exactly one new mutable in-memory store (`ApiKey`, keyed by the raw key value) whose size is
bounded by request volume and which is fully reset by `tests/helpers/resetStores.ts` between
tests, preserving Principle II's determinism guarantee — reinforced here by `kind: valid` keys
never expiring, so this feature has strictly less wall-clock-dependent state than Spec 005's JWT
flow. `contracts/api-key-basic-auth.openapi.yaml` documents exactly the 4 operations and two new
security schemes (`apiKeyAuth`, `basicAuth`) this spec implements, reusing the root document's
`Error` schema and `Unauthorized`/`NotFound` reusable responses rather than duplicating them. No
`allOf`/`oneOf`/`anyOf` combinators are used anywhere in the contract, consistent with every prior
spec's OpenAPI fragment. The quickstart's issue→use→revoke cycle, `kind`-matrix walkthrough, and
Basic Auth valid/invalid/missing/malformed walkthrough directly exercise Principles II, III, and
IV (no secret ever appears in a captured response body other than the one-time key issuance).
No new violations introduced during design; Complexity Tracking remains empty.
