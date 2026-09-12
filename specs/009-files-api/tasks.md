---

description: "Task list template for feature implementation"
---

# Tasks: Files API

**Input**: Design documents from `/specs/009-files-api/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/files-api.openapi.yaml](contracts/files-api.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations explicitly names file upload/download
among the required automated-suite coverage, and the constitution's Quality Gates ("new or
changed endpoints MUST include corresponding automated test coverage ... before being considered
done") make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. Unlike Spec 008 (four fully-separate endpoints), all
four of this feature's user stories operate on the *same* two routes (`/files`, `/files/{id}`)
and the same small set of files (`file.service.ts`, `file.controller.ts`, `files.routes.ts`,
`files.test.ts`), so later stories additively extend files earlier stories create rather than
creating new ones — dependency notes call this out per task. Each story remains independently
testable: its own acceptance scenarios (and its own block of tests) exercise only that story's
operation, using an upload (US1) as the necessary setup step for US2-US4, exactly as spec.md's
own "Independent Test" sections describe.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US4)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-008 layout. No new top-level directories. `src/app.ts`, `src/middleware/errorHandler.ts`,
and `tests/helpers/resetStores.ts` are the only shared, cross-cutting files touched, each exactly
once. No other prior spec's resource/feature file is touched at all — this feature is fully
additive and self-contained.

---

## Phase 1: Setup

**Purpose**: New dependency this feature requires.

- [X] T001 Add `multer` (runtime) and `@types/multer` (dev) to `package.json` via
      `npm install multer` and `npm install --save-dev @types/multer` (research.md Decision 1 —
      the one new dependency this feature introduces, for multipart/form-data parsing).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared model, store, and configuration every one of this feature's four user
stories reads or writes — unlike Spec 008, all four stories here operate on one entity, so this
phase is a real blocking prerequisite, not an empty one.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create `src/models/file.ts`: `export interface FileRecord { id: string; filename:
      string; contentType: string; size: number; uploadedAt: string; sequence: number; content:
      Buffer; }` and `export interface FileMetadata { id: string; filename: string; contentType:
      string; size: number; uploadedAt: string; }` (data-model.md — `FileRecord` is the internal,
      never-directly-serialized shape; `FileMetadata` is the caller-facing projection that omits
      `content` and `sequence`).
- [X] T003 [P] Create `src/data/files.store.ts`: `import { createKeyedStore } from
      "./keyedStore"; import type { FileRecord } from "../models/file"; export const fileStore =
      createKeyedStore<FileRecord>(); let nextSequence = 0; export function nextFileSequence():
      number { nextSequence += 1; return nextSequence; } export function resetFileSequence():
      void { nextSequence = 0; }` (research.md Decision 3 — reuses the existing generic
      string-keyed store, exactly as `paymentStore`/`apiKeyStore` already do; research.md
      Decision 4 — the module-level `nextSequence` counter is the tie-break mechanism for
      deterministic newest-first ordering, since `uploadedAt` alone can collide at millisecond
      resolution).
- [X] T004 [P] Add two entries to `envSchema` in `src/config/env.schema.ts`, immediately after
      `MAX_PAYLOAD_SIZE`: `MAX_FILE_SIZE: z.string().min(1).default("2mb"),` and
      `MAX_STORED_FILES: numeric(z.number().int().positive()).default(50),` (spec.md
      Clarifications — confirmed defaults `2mb` / `50`; research.md Decision 8 — `MAX_FILE_SIZE`
      is a `bytes`-parseable string, matching the existing `MAX_PAYLOAD_SIZE` convention, not a
      raw integer).
- [X] T005 Add `maxFileSize: string;` and `maxStoredFiles: number;` to the `ConfigurationProfile`
      interface and `maxFileSize: parsed.MAX_FILE_SIZE, maxStoredFiles: parsed.MAX_STORED_FILES,`
      to the returned object in `loadConfig`, both in `src/config/index.ts` (depends on T004).
- [X] T006 [P] Add `MAX_FILE_SIZE=2mb` and `MAX_STORED_FILES=50` entries to `.env.example`,
      immediately after `MAX_PAYLOAD_SIZE=10mb`, with comments following the existing style:
      "Maximum size of a single uploaded file for POST /files. Accepts the same size-string
      format as MAX_PAYLOAD_SIZE (e.g. 2mb). Default: 2mb." and "Maximum number of files
      GET/POST /files may hold at once; POST /files returns 409 once reached (no eviction).
      Default: 50." (depends on T004; also add the same two lines to a local `.env` file if one
      exists, so the running dev server picks up the new defaults).
- [X] T007 Extend `tests/helpers/resetStores.ts` (depends on T003): import `fileStore,
      resetFileSequence` from `../../src/data/files.store` and add `fileStore.reset([]);
      resetFileSequence();` to `resetStores()`.

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Upload a File (Priority: P1) 🎯 MVP

**Goal**: `POST /files` accepts a single file via multipart/form-data under the field name
`upload`, stores it entirely in memory, and returns `201` with its identifier and metadata —
rejecting a missing/misnamed field (`400`), an oversized file (`413`), or a full store (`409`)
without ever storing or evicting anything.

**Independent Test**: Upload a small file via `POST /files` and confirm `201` with an
identifier, filename, content type, and byte size matching what was sent; confirm a missing
field, an oversized file, and a full store are each rejected correctly. See quickstart.md
Scenario 1.

### Implementation for User Story 1

- [X] T008 [US1] Create `src/services/file.service.ts` (depends on T002, T003, T005): export
      `toFileMetadata(record: FileRecord): FileMetadata` — returns `{ id: record.id, filename:
      record.filename, contentType: record.contentType, size: record.size, uploadedAt:
      record.uploadedAt }`, omitting `content` and `sequence` (FR-010, data-model.md). Export
      `uploadFile(file: { buffer: Buffer; originalname: string; mimetype: string }):
      FileMetadata` — first, `if (fileStore.list().length >= config.maxStoredFiles) throw new
      HttpError(409, "STORAGE_LIMIT_EXCEEDED", \`Maximum stored file count
      (${config.maxStoredFiles}) reached; delete a file before uploading another.\`);` (FR-004,
      research.md Decision 3 — checked *before* building or storing any record, and never evicts
      an existing file). Otherwise build `const record: FileRecord = { id: randomUUID(),
      filename: file.originalname, contentType: file.mimetype || "application/octet-stream",
      size: file.buffer.length, uploadedAt: new Date().toISOString(), sequence:
      nextFileSequence(), content: file.buffer };` (FR-001, FR-006, research.md Decision 6 — the
      `|| "application/octet-stream"` fallback), call `fileStore.create(record);`, and return
      `toFileMetadata(record)`. A zero-byte `file.buffer` (`length === 0`) is accepted like any
      other — no special-casing needed (FR-005).
- [X] T009 [US1] Create `src/controllers/file.controller.ts` (depends on T008): export
      `postFile(req: Request, res: Response): void` — `if (!req.file) { throw new
      HttpError(400, "VALIDATION_ERROR", "The 'upload' file field is required."); }` (FR-002 —
      covers both a non-multipart body and a multipart body missing the `upload` field, since
      `multer` leaves `req.file` undefined in both cases); otherwise
      `res.status(201).json(fileService.uploadFile(req.file));`.
- [X] T010 [US1] Extend `src/middleware/errorHandler.ts` (no file dependency, but logically part
      of US1 — the only story whose error paths can produce a `MulterError`): import `MulterError`
      from `"multer"`; add one more `if` block, positioned alongside the existing
      `isJsonParseError`/`isPayloadTooLargeError` checks (before the generic 500 fallback): `if
      (err instanceof MulterError) { const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 :
      400; const code = err.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "VALIDATION_ERROR";
      res.status(statusCode).json(buildErrorEnvelope(code, err.message, requestId, { multerCode:
      err.code })); return; }` (research.md Decision 2 — `LIMIT_FILE_SIZE` maps to `413`
      `FILE_TOO_LARGE` per FR-003; every other `MulterError` code, e.g. `LIMIT_UNEXPECTED_FILE`
      from a wrongly-named field, maps to `400` `VALIDATION_ERROR` per FR-002).
- [X] T011 [US1] Create `src/routes/files.routes.ts` (depends on T009, T010): `import { Router }
      from "express"; import multer from "multer"; import bytes from "bytes"; import { config }
      from "../config"; import { methodNotAllowedHandler } from
      "../middleware/methodNotAllowed"; import * as fileController from
      "../controllers/file.controller";` — `const upload = multer({ storage:
      multer.memoryStorage(), limits: { fileSize: bytes.parse(config.maxFileSize) as number } });`
      (research.md Decision 1 — memory storage only, per-file size enforced by `multer` itself
      before the full body is buffered) `export const filesRouter = Router({ strict: true });`
      `filesRouter.post("/files", upload.single("upload"), fileController.postFile);`
      `filesRouter.all("/files", methodNotAllowedHandler);` (the catch-all for `/files` — later
      stories that add more methods on this exact path must insert their route **above** this
      line).
- [X] T012 [US1] Wire `filesRouter` into `src/app.ts` (depends on T011): mount it top-level
      (alongside `delayRouter`/`payloadRouter`/.../`cacheRouter` from Specs 007-008), matching
      CLAUDE.md's `/files` path spelling (no `/api/v1` prefix — spec.md Assumptions, research.md
      Decision 8).
- [X] T013 [P] [US1] Create `tests/files.test.ts` (depends on T012, T007): import `resetStores`
      and call it in `beforeEach`. `POST /files` with `.attach("upload", Buffer.from("hello"),
      "hello.txt")` → `201` with a UUID `id`, `filename: "hello.txt"`, a `contentType`, `size:
      5`, and an `uploadedAt` string (FR-001). `.attach("upload", Buffer.alloc(0), "empty.bin")`
      → `201` with `size: 0` (FR-005). `POST /files` with no attached file at all → `400`
      (FR-002). `.attach("wrongField", Buffer.from("x"), "x.txt")` → `400` (FR-002). A file
      larger than `config.maxFileSize` (e.g. attach a `Buffer.alloc(bytes.parse(config
      .maxFileSize) + 1)`) → `413` `FILE_TOO_LARGE` (FR-003). Uploading until
      `config.maxStoredFiles` is reached, then one more → `409` `STORAGE_LIMIT_EXCEEDED`, and
      confirm the store's size afterward is still exactly `config.maxStoredFiles` (FR-004, no
      eviction).

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md
Scenario 1).

---

## Phase 4: User Story 2 - Download a File (Priority: P2)

**Goal**: `GET /files/{id}` returns a previously uploaded file's exact original bytes with its
original `Content-Type` and a `Content-Disposition` naming its original filename; a nonexistent
or deleted id returns `404`, a malformed id returns `400`.

**Independent Test**: Upload a file, then `GET /files/{id}` and confirm the response body is
byte-for-byte identical to what was uploaded, with matching content type and filename. See
quickstart.md Scenario 2.

### Implementation for User Story 2

- [X] T014 [P] [US2] Create `src/utils/contentDisposition.ts`: export
      `buildContentDisposition(filename: string): string` — first strip CR/LF and other C0
      control characters from `filename` (`filename.replace(/[\x00-\x1F\x7F]/g, "")`); build the
      ASCII-safe fallback by escaping any `"`/`\` (`safe.replace(/["\\]/g, "\\$&")`); return
      `` `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(stripped)}` ``
      (research.md Decision 7 — a caller-controlled filename must never reach `res.set(...)`
      unsanitized, since Node's `http` module throws on an embedded CR/LF, which would otherwise
      turn a crafted filename into an unhandled `500`, violating the fail-safe-handling
      principle; the RFC 6266 `filename*=` parameter preserves non-ASCII names for modern
      clients).
- [X] T015 [US2] Extend `src/services/file.service.ts` (depends on T008): export
      `getFileRecordById(id: string): FileRecord` — `const record = fileStore.get(id); if
      (!record) throw new HttpError(404, "RESOURCE_NOT_FOUND", \`File ${id} not found.\`); return
      record;` (FR-008 — covers both "never uploaded" and "since deleted," since a deleted
      record is simply absent from the store).
- [X] T016 [US2] Extend `src/controllers/file.controller.ts` (depends on T015, T014): export
      `getFileById(req: Request, res: Response): void` — `const id = parseUuidParam(req.params
      .id, "file");` (FR-009 — malformed id → `400`, via the existing shared `parseUuidParam`)
      `const record = fileService.getFileRecordById(id);`
      `res.status(200).set("Content-Disposition", buildContentDisposition(record.filename))
      .type(record.contentType).send(record.content);` (FR-007).
- [X] T017 [US2] Extend `src/routes/files.routes.ts` (depends on T016, T011): add
      `filesRouter.get("/files/:id", fileController.getFileById);` and
      `filesRouter.all("/files/:id", methodNotAllowedHandler);` (a new path, its own catch-all —
      later stories that add more methods on `/files/:id` must insert their route **above** this
      new catch-all line).
- [X] T018 [US2] Extend `tests/files.test.ts` (depends on T017): upload a small file, capture its
      `id`, then `GET /files/{id}` → `200` with a body exactly equal (byte-for-byte) to the
      uploaded content, the same `Content-Type`, and a `Content-Disposition` header containing the
      original filename (FR-007). `GET /files/00000000-0000-0000-0000-000000000000` (a
      well-formed but unused UUID) → `404` (FR-008). `GET /files/not-a-uuid` → `400` (FR-009).
      Upload a file with a filename containing a space and a non-ASCII character (e.g.
      `"my caf\u00e9.txt"`), download it, and confirm the response doesn't crash and the
      `Content-Disposition` header round-trips a decodable filename (spec.md Edge Cases,
      research.md Decision 7).

**Checkpoint**: User Stories 1 and 2 both work independently (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - List Uploaded Files (Priority: P3)

**Goal**: `GET /files` returns every stored file's metadata (never raw content), newest-first,
inside the standard pagination envelope, validating `page`/`limit` like every other list
endpoint.

**Independent Test**: Upload two or more files, call `GET /files`, and confirm every uploaded
file's metadata appears in the paginated result, newest first, with no raw content included. See
quickstart.md Scenario 3.

### Implementation for User Story 3

- [X] T019 [US3] Extend `src/services/file.service.ts` (depends on T008): export
      `listFiles(rawQuery: Record<string, unknown>): ListQueryResult<FileMetadata> & { page:
      number; limit: number }` — `const query = parseListQuery(rawQuery, { allowedSortFields: []
      });` (research.md Decision 5 — no caller-facing sort field; any `?sort=` value is rejected
      with the same `400` shape every other resource uses for an unrecognized sort field) `const
      sorted = [...fileStore.list()].sort((a, b) => b.sequence - a.sequence);` (research.md
      Decision 4 — deterministic newest-first order via the collision-proof `sequence` counter,
      not `uploadedAt` string comparison) `const { data, total } = applyListQuery(sorted,
      query);` return `{ data: data.map(toFileMetadata), total, page: query.page, limit:
      query.limit };` (FR-010 — every returned item is a `FileMetadata`, never a `FileRecord`
      with its `content`).
- [X] T020 [US3] Extend `src/controllers/file.controller.ts` (depends on T019): export
      `getFiles(req: Request, res: Response): void` — `const { data, page, limit, total } =
      fileService.listFiles(req.query as unknown as Record<string, unknown>);`
      `res.status(200).json(buildPaginationEnvelope(data, page, limit, total));` (FR-010,
      FR-011).
- [X] T021 [US3] Extend `src/routes/files.routes.ts` (depends on T020, T011): insert
      `filesRouter.get("/files", fileController.getFiles);` **above** the existing
      `filesRouter.all("/files", methodNotAllowedHandler);` line from T011 (the catch-all must
      stay last, after every real method is registered on that exact path — mirrors Spec 008's
      `payment.routes.ts` precedent).
- [X] T022 [US3] Extend `tests/files.test.ts` (depends on T021): with no files uploaded (after
      `resetStores()`), `GET /files` → `200` with `{ data: [], pagination: { total: 0, ... } }`.
      Upload three files in sequence, then `GET /files` → `200` with all three in `data`, ordered
      newest-first (the most recently uploaded file's `id` appears at `data[0]`), and confirm no
      item in `data` has a `content` property (FR-010). `GET /files?page=1&limit=2` against more
      than two stored files → `200` with exactly 2 items and `pagination.hasNext: true`. `GET
      /files?page=0` → `400` (FR-011, same validation as every other paginated list endpoint).

**Checkpoint**: User Stories 1, 2, and 3 all work independently (quickstart.md Scenario 3).

---

## Phase 6: User Story 4 - Delete a File (Priority: P4)

**Goal**: `DELETE /files/{id}` removes a previously uploaded file and returns `204`; a
nonexistent or already-deleted id returns `404`; a malformed id returns `400`.

**Independent Test**: Upload a file, `DELETE /files/{id}` (expect `204`), then confirm a
subsequent `GET /files/{id}` returns `404` and the file no longer appears in `GET /files`. See
quickstart.md Scenario 4.

### Implementation for User Story 4

- [X] T023 [US4] Extend `src/services/file.service.ts` (depends on T008): export
      `deleteFileById(id: string): void` — `const removed = fileStore.remove(id); if (!removed)
      throw new HttpError(404, "RESOURCE_NOT_FOUND", \`File ${id} not found.\`);` (FR-013 — a
      repeated delete of an already-removed id is indistinguishable from "never existed," so it
      also returns `404`, never a second `204`).
- [X] T024 [US4] Extend `src/controllers/file.controller.ts` (depends on T023): export
      `deleteFileById(req: Request, res: Response): void` — `const id = parseUuidParam(req.params
      .id, "file");` (FR-014 — malformed id → `400`) `fileService.deleteFileById(id);
      res.status(204).end();` (FR-012).
- [X] T025 [US4] Extend `src/routes/files.routes.ts` (depends on T024, T017): insert
      `filesRouter.delete("/files/:id", fileController.deleteFileById);` **above** the existing
      `filesRouter.all("/files/:id", methodNotAllowedHandler);` line from T017 (same
      insert-before-catch-all rule as T021).
- [X] T026 [US4] Extend `tests/files.test.ts` (depends on T025): upload a file, capture its `id`,
      `DELETE /files/{id}` → `204` with no body (FR-012); immediately after, `GET /files/{id}` →
      `404`, and `GET /files` no longer lists that `id` in `data` (both confirming immediate
      removal). A second `DELETE /files/{id}` for the same, now-deleted `id` → `404`, not a
      repeated `204` (FR-013). `DELETE /files/not-a-uuid` → `400` (FR-014). `DELETE
      /files/00000000-0000-0000-0000-000000000000` (well-formed, never uploaded) → `404`.

**Checkpoint**: All four user stories independently functional (quickstart.md Scenario 4).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [X] T027 [P] Merge `contracts/files-api.openapi.yaml`'s `tags`, `paths` (`/files`,
      `/files/{id}`), `components.parameters` (`FileIdParam`), `components.schemas`
      (`FileMetadata`), and `components.responses` (`StorageLimitExceeded`) into the root
      `openapi.yaml`, reusing the existing `Error`/`ValidationError`/`NotFound`/
      `PayloadTooLarge`/`PaginationMeta`/`PageParam`/`LimitParam` schemas/responses/parameters
      rather than duplicating them, so `/docs`, `/openapi.json`, and `/openapi.yaml` document
      exactly the 4 operations this spec implements (constitution: Quality Gates & Spec Parity).
      No `allOf`/`oneOf`/`anyOf` combinators (project memory: OpenAPI spec must avoid
      combinators).
- [X] T028 Run `npm test` and confirm the full suite — Specs 001-008's existing tests plus
      `tests/files.test.ts` — passes, including confirming every other existing test file is
      unaffected (this feature touches no prior spec's resource file).
- [X] T029 Execute the manual validation scenarios in `specs/009-files-api/quickstart.md`
      (Scenarios 1-5) against a running `npm run dev` server and confirm every expected status
      code, header, and body — including the storage-cap Scenario 5, which requires the default
      `MAX_STORED_FILES=50`.
- [X] T030 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 4
      new operations correctly with no schema errors. Note: `GET /api/v1/routes` is not yet
      implemented in this codebase (Spec 012's deliverable per the roadmap) — verified instead
      that `/openapi.json` lists exactly `/files` and `/files/{id}` with the documented methods,
      and every `$ref` in them resolves.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001, for the type-checked `multer` import used
  indirectly via config wiring is not required here, but `files.routes.ts` in Phase 3 needs it) —
  BLOCKS all user stories, since all four operate on the same `FileRecord`/`fileStore`/config.
- **User Stories (Phase 3-6)**: All depend on Foundational (Phase 2) completion. Within this
  feature they also have a soft, file-level ordering — US2/US3/US4 each *extend* files US1
  creates (`file.service.ts`, `file.controller.ts`, `files.routes.ts`, `files.test.ts`) — so
  while each story is independently testable, implementing them in priority order (US1 → US2 →
  US3 → US4) avoids merge conflicts on those shared files.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational. No dependency on any other story.
- **User Story 2 (P2)**: Depends on Foundational; extends the files US1 creates (T008-T011) —
  must follow US1 in implementation order, though its own acceptance test only requires *an*
  upload to exist first (which its own test performs).
- **User Story 3 (P3)**: Depends on Foundational; extends the files US1 creates — same
  file-level ordering as US2 (independent of US2 itself).
- **User Story 4 (P4)**: Depends on Foundational; extends the files US1 *and* US2 create (needs
  the `/files/:id` path US2 establishes in T017 to insert `DELETE` above its catch-all).

### Within Each User Story

- US1: model + store + config (Foundational, parallel where marked) → service → controller →
  error-handler extension → routes (+ multer config) → `app.ts` wiring → tests.
- US2: content-disposition util (parallel, no dependency on US1's files) → extend service →
  extend controller → extend routes (new path) → extend tests.
- US3: extend service → extend controller → extend routes (insert before existing catch-all) →
  extend tests.
- US4: extend service → extend controller → extend routes (insert before existing catch-all,
  depends on US2's path existing) → extend tests.

### Parallel Opportunities

- Within Foundational: T002, T003, T004, T006 run in parallel (different files); T005 depends on
  T004; T007 depends on T003.
- T014 (US2's `contentDisposition.ts`) can be created in parallel with any Foundational or US1
  task — it has no dependency on `FileRecord`/`fileStore` at all, only on plain strings.
- T013 (US1 tests) is marked `[P]` relative to other stories' work but not relative to T012,
  which it depends on.
- T027 and T030 (Polish) run in parallel; T028 and T029 are sequential whole-suite/manual checks
  that should follow T027.
- Unlike Spec 008, the four user stories here are **not** fully parallelizable against each
  other, since US2-US4 all extend the same three files US1 creates (`file.service.ts`,
  `file.controller.ts`, `files.routes.ts`) plus the shared `files.test.ts` — implement in
  priority order (US1 → US2 → US3 → US4) to avoid conflicting edits to those files.

---

## Parallel Example: Foundational Phase

```bash
# T002, T003, T004, T006 have no dependencies on each other:
Task: "Create src/models/file.ts"
Task: "Create src/data/files.store.ts"
Task: "Add MAX_FILE_SIZE/MAX_STORED_FILES to src/config/env.schema.ts"
Task: "Add MAX_FILE_SIZE/MAX_STORED_FILES to .env.example"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`multer` dependency).
2. Complete Phase 2: Foundational (model, store, config — CRITICAL, blocks all stories).
3. Complete Phase 3: User Story 1 (upload, full test coverage).
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
5. Deploy/demo if ready — this alone gives testing tools a working file-upload endpoint to
   validate multipart handling and size/capacity limits against.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 (upload) → test independently → deploy/demo (MVP!).
3. User Story 2 (download) → test independently → deploy/demo.
4. User Story 3 (list) → test independently → deploy/demo.
5. User Story 4 (delete) → test independently → deploy/demo.
6. Polish → spec/implementation parity confirmed, full suite green.

Order among Stories 1-4 should follow priority (P1→P4) given the shared-file extension pattern
noted above — unlike Spec 008, these are not freely reorderable/parallelizable across developers
without coordinating the same three files.

### Parallel Team Strategy

Given the shared-file dependency chain, the most effective parallel split is: one developer
completes Foundational + US1 first (establishing `file.service.ts`/`file.controller.ts`/
`files.routes.ts`), then US2, US3, and US4 can be split across developers working in the *same*
three files sequentially/by coordination (e.g. via short-lived branches merged in priority
order) rather than fully independently, since each adds one function per file and one route
insertion.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps a task to its user story for traceability.
- `sequence` (research.md Decision 4) is an internal-only ordering aid — `toFileMetadata` must
  never expose it, matching FR-010's "never a file's raw content" spirit for anything not part
  of the documented contract.
- `buildContentDisposition` (T014) is a pure string function — trivially unit-testable in
  isolation from the store/service, and used only by T016's controller.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story
  dependencies that would break a later story's ability to be demoed on its own.
