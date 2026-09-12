# Phase 1 Data Model: Files API

One new mutable, UUID-keyed entity (`FileRecord`), plus its caller-facing projection
(`FileMetadata`, which omits the raw content). No existing entity is modified.

## FileRecord (mutable, keyed store — internal, never serialized directly)

```ts
export interface FileRecord {
  id: string;           // UUID, assigned via randomUUID() at upload time
  filename: string;      // original filename as supplied in the multipart part; unsanitized at rest
  contentType: string;    // declared content type, or "application/octet-stream" if none was given
  size: number;           // exact byte length of the stored content
  uploadedAt: string;      // ISO 8601 timestamp, set at upload time
  sequence: number;         // monotonically increasing counter, for deterministic newest-first ordering (research.md Decision 4)
  content: Buffer;          // raw bytes, held only in memory; NEVER included in any list/metadata response
}
```

Stored in `fileStore = createKeyedStore<FileRecord>()` (`src/data/files.store.ts`), alongside a
module-level `nextSequence` counter. Lifecycle: created by `POST /files` (once per successful
upload); removed by `DELETE /files/{id}`; never updated in place (no `PUT`/`PATCH` on this
resource, per CLAUDE.md item #24 and spec.md's scope). `reset()` (via `fileStore.reset([])`, plus
resetting `nextSequence` to `0`) empties the store — called by `tests/helpers/resetStores.ts` and,
once it exists, Spec 011's admin-reset endpoint (FR-018).

## FileMetadata (caller-facing projection, not separately stored)

```ts
export interface FileMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}
```

Produced by `toFileMetadata(record: FileRecord): FileMetadata` (`src/services/file.service.ts`),
which strips `content` and `sequence` — the two fields no response may ever expose (`content` per
FR-010's "never a file's raw content"; `sequence` is a pure internal ordering aid, not part of
the documented contract). Returned by `POST /files` (the newly created file) and `GET /files`
(every stored file, paginated).

## Validation rules (from Functional Requirements)

- `POST /files`: requires a well-formed `multipart/form-data` body with exactly one file under the
  field name `upload` (Clarifications) → else `400 VALIDATION_ERROR` (FR-002). The uploaded file's
  byte size must not exceed `bytes.parse(config.maxFileSize)` (default `2mb`) → else
  `413 FILE_TOO_LARGE` (FR-003), enforced by `multer`'s `limits.fileSize` (research.md Decision 1)
  before the full body is buffered. The current stored-file count must be below
  `config.maxStoredFiles` (default `50`) → else `409 STORAGE_LIMIT_EXCEEDED` (FR-004), checked
  before any new record is created. A zero-byte file is valid (FR-005). A missing content type on
  the uploaded part defaults to `application/octet-stream` (FR-006, research.md Decision 6).
- `GET /files/{id}`: `{id}` must match the UUID format (reusing `parseUuidParam`) → else
  `400 VALIDATION_ERROR` (FR-009); a syntactically valid `id` with no matching stored file (never
  uploaded, or since deleted) → `404 RESOURCE_NOT_FOUND` (FR-008).
- `GET /files`: `page`/`limit` validated via the shared `parseListQuery` (defaults `page=1`,
  `limit=20`, `limit` capped at `100`) → invalid values → `400 VALIDATION_ERROR` (FR-011); no
  `sort` field is supported (research.md Decision 5) — results are always ordered by `sequence`
  descending (newest first).
- `DELETE /files/{id}`: same `{id}` rules as `GET /files/{id}` — malformed → `400`; not found
  (including a repeated delete) → `404` (FR-013/FR-014).
