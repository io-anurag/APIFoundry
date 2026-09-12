# Implementation Plan: Files API

**Branch**: `009-files-api` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-files-api/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver a self-contained, bounded file upload/download/list/delete surface: `POST /files`
(multipart/form-data, field name `upload`, `201` with metadata), `GET /files` (paginated metadata
list, newest-first, never raw content), `GET /files/{id}` (raw bytes with original `Content-Type`
and a safely-encoded `Content-Disposition`), and `DELETE /files/{id}` (`204`) — all top-level,
unauthenticated, and in-memory only. Technical approach: add `multer` (memory storage) as the one
new dependency for multipart parsing, enforcing the per-file size cap via its `limits.fileSize`
and translating its errors centrally in the existing `errorHandler.ts` (alongside the project's
existing body-parser/Zod error translation); store files in a new UUID-keyed
`createKeyedStore<FileRecord>()` (`files.store.ts`), rejecting a new upload with `409` once
`config.maxStoredFiles` is reached rather than evicting; order `GET /files` deterministically via
an internal monotonic `sequence` counter (not string comparison of timestamps, which can collide
at millisecond resolution); and sanitize any caller-supplied filename before it reaches the
`Content-Disposition` header, since Node's `http` module would otherwise crash on an embedded
CR/LF. Two new environment variables, `MAX_FILE_SIZE` (default `2mb`) and `MAX_STORED_FILES`
(default `50`), are added, both confirmed in spec.md's Clarifications session. See
[research.md](research.md) for full rationale on every non-obvious decision.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.x (LTS) — unchanged from Specs 001-008

**Primary Dependencies**: Express 4.x, `zod` (request validation), `bytes` (parsing
`MAX_FILE_SIZE`, reusing the existing `MAX_PAYLOAD_SIZE` convention) — all already present. One
new dependency: `multer` (+ `@types/multer`) for multipart/form-data parsing, memory storage
mode only (research.md Decision 1).

**Storage**: In-memory only, consistent with the whole project. One new
`createKeyedStore<FileRecord>()` instance (`src/data/files.store.ts`) plus a module-level
`nextSequence` counter — no database, no disk writes, no external cache.

**Testing**: Vitest + Supertest — unchanged from Specs 001-008. Supertest's `.attach(field, path)`
exercises real multipart requests against `POST /files`.

**Target Platform**: Node.js server (Linux/Windows/macOS), run locally, in CI, and as a target for
external testing tools (k6, Postman, contract-test suites) — upload/download/list/delete is
exactly the file-handling surface those tools most commonly need to validate against.

**Project Type**: Single backend web-service (REST API server), no frontend — unchanged.

**Performance Goals**: Every endpoint's own work beyond the upload/download I/O itself is O(1) or
O(page size) (store lookup, capacity-count compare, metadata projection, pagination slice) — no
external network call, no expensive computation. Memory use is explicitly bounded (not
unconditionally O(1)): worst case is `MAX_FILE_SIZE` × `MAX_STORED_FILES` (~100MB at the
confirmed defaults), per the constitution's bounded-resource principle.

**Constraints**: An oversized upload must be rejected without buffering its full body
(`multer`'s streaming size-limit enforcement, research.md Decision 1); a full store must reject
new uploads without evicting existing files (FR-004); `GET /files`'s default order must be
deterministic even for uploads landing in the same millisecond (research.md Decision 4); a
caller-supplied filename must never crash the process when placed into a response header
(research.md Decision 7).

**Scale/Scope**: This spec only — 4 operations across 2 paths (`/files`, `/files/{id}`); depends
only on Spec 001's foundation (config, error envelope, request-id middleware, pagination
envelope). No other prior spec's file is modified except `src/app.ts` (router mount),
`src/config/env.schema.ts`/`src/config/index.ts` (two new env vars), `src/middleware/
errorHandler.ts` (one new error-shape translation), `tests/helpers/resetStores.ts` (one new
`reset()` call), and `.env.example`/`package.json` — all additive. Independently
buildable/testable in parallel with Specs 002-008 per the roadmap.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Gate | Status | Notes |
|---|---|---|
| I. Testing-Playground Purpose | PASS | Adds the file upload/download/list/delete surface CLAUDE.md item #24 calls for — pure surface expansion; nothing narrowed. |
| II. Determinism & Reproducibility | PASS | No randomness anywhere in this feature; the one determinism risk identified (same-millisecond `uploadedAt` ties) is resolved by a monotonic `sequence` counter (research.md Decision 4), so `GET /files` ordering is deterministic for a given stored set. |
| III. Fail-Safe Handling & Consistent Contracts | PASS | Every failure path (missing/misnamed field, oversized file, full store, not-found, malformed id) resolves to a structured response via the existing `HttpError`/`ErrorEnvelope`/`X-Request-ID` machinery; a caller-supplied filename is sanitized before reaching a response header specifically to prevent an unhandled crash (research.md Decision 7), directly serving this principle. |
| IV. Secret & Credential Hygiene | PASS | This feature introduces no secret-bearing configuration, header, or credential; uploaded file content is arbitrary caller data, not a project secret, and is never logged. |
| V. Bounded Resource Usage Under Load | PASS | Per-file size is capped by `MAX_FILE_SIZE` (enforced by `multer` before full buffering); total stored-file count is capped by `MAX_STORED_FILES` with no eviction; no endpoint performs an external call or unbounded computation. Worst-case memory is an explicit, documented, configurable bound (~100MB at defaults), consistent with how Spec 007's `/payload` and `MAX_PAYLOAD_SIZE` already bound a similar concern. |
| Architecture Constraints (stack, `/api/v1` prefix, module split, Vitest+Supertest) | PASS | New code follows the existing `routes/controllers/services/models/data/utils` split with no new top-level directory; `/files` mounts top-level (no `/api/v1` prefix), matching CLAUDE.md's bare-path spelling and Spec 007/008's precedent for identically-shaped generic testing utilities. |
| Quality Gates & Spec Parity | PASS (gate to verify at implementation time) | `openapi.yaml` must gain exactly the 2 paths / 4 operations in `contracts/files-api.openapi.yaml` — no more, no less — verified in quickstart.md's docs-surface check. |

No violations requiring justification; Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/009-files-api/
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
├── data/
│   └── files.store.ts            # NEW: createKeyedStore<FileRecord>() + nextSequence counter + reset()
├── models/
│   └── file.ts                    # NEW: FileRecord, FileMetadata interfaces + toFileMetadata()
├── utils/
│   └── contentDisposition.ts      # NEW: buildContentDisposition(filename) — sanitizes + RFC 6266 encodes
├── services/
│   └── file.service.ts             # NEW: uploadFile, listFiles, getFileById, deleteFileById
├── controllers/
│   └── file.controller.ts          # NEW: postFile, getFiles, getFileById, deleteFileById
├── routes/
│   └── files.routes.ts              # NEW: multer config + GET/POST /files, GET/DELETE /files/:id
├── middleware/
│   └── errorHandler.ts               # existing; gains MulterError -> 413/400 translation
├── config/
│   ├── env.schema.ts                  # existing; gains MAX_FILE_SIZE, MAX_STORED_FILES
│   └── index.ts                        # existing; gains maxFileSize, maxStoredFiles
└── app.ts                                # existing; gains filesRouter import + app.use(filesRouter)

tests/
├── files.test.ts                          # NEW
└── helpers/resetStores.ts                  # existing; gains fileStore.reset([]) + sequence reset

.env.example                                 # existing; gains MAX_FILE_SIZE, MAX_STORED_FILES
package.json                                  # existing; gains multer, @types/multer
openapi.yaml                                   # existing; gains the paths/schemas from contracts/files-api.openapi.yaml
```

**Structure Decision**: Extends the existing Specs 001-008 single-backend-project layout with no
new top-level directory — every new file follows the established one-concern-per-layer
convention (`routes/controllers/services/models/data/utils`). No prior spec's resource file is
touched at all (unlike Spec 008, which extended `payment.*`); this feature is fully additive and
self-contained, preserving the roadmap's parallelizability with every other spec.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.

## Post-Design Constitution Check

*Re-checked after Phase 1 design (data-model.md, contracts/, quickstart.md).*

All gates from the pre-design Constitution Check above still PASS. `data-model.md` confirms
`FileRecord` follows the project's existing `reset()`-per-store convention (FR-018), and that the
caller-facing `FileMetadata` projection strictly excludes both `content` (FR-010) and the internal
`sequence` field (never part of the documented contract). `contracts/files-api.openapi.yaml`
documents exactly the 4 operations this spec implements (reusing the root document's `Error`,
`ValidationError`, `NotFound`, `PayloadTooLarge`, and `PaginationMeta` schemas/responses, and
adding one new reusable response — `StorageLimitExceeded` (409) — for future specs to reuse
rather than duplicate, mirroring how Spec 008 added `RateLimited`/`Conflict`). No `allOf`/`oneOf`/
`anyOf` combinators are used anywhere in the contract, consistent with every prior spec's OpenAPI
fragment (and with the standing project memory that the downstream spec-analysis tool cannot
handle them). The quickstart's upload/download/list/delete and storage-cap walkthroughs directly
exercise Principles II, III, and V (deterministic newest-first ordering, no-crash filename
handling, and a bounded storage cap that rejects rather than evicts). No new violations
introduced during design; Complexity Tracking remains empty.
