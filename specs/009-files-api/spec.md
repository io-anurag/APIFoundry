# Feature Specification: Files API

**Feature Branch**: `009-files-api`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Spec 009 — Files API"

## Clarifications

### Session 2026-09-12

- Q: What should the default maximum per-file upload size and maximum stored-file count be? → A:
  `MAX_FILE_SIZE=2mb`, `MAX_STORED_FILES=50` — keeps worst-case in-memory usage bounded (~100MB)
  while staying large enough for realistic test files.
- Q: What should the multipart form field name be for the uploaded file in `POST /files`? → A:
  `upload`.
- Q: In what order should `GET /files` return files when no sort option is requested? → A:
  Descending by upload time (newest first), deterministically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a File (Priority: P1)

A tester or automated test suite uploads a file to the server and receives back a unique
identifier and metadata confirming what was stored, so later steps in the same test can reference
that file.

**Why this priority**: Upload is the entry point for every other capability in this spec — nothing
can be listed, downloaded, or deleted until at least one file exists. CLAUDE.md calls out file
upload as its own testable concern (#24) independent of every other feature area.

**Independent Test**: Can be fully tested by uploading a small file via `POST /files` and
confirming the response returns `201` with an identifier, the original filename, content type, and
byte size matching what was sent.

**Acceptance Scenarios**:

1. **Given** a well-formed multipart upload containing one file under the `upload` field name,
   **When** the client calls `POST /files`, **Then** the system returns `201` with the new file's
   identifier, filename, content type, byte size, and upload timestamp.
2. **Given** a file whose size is within the configured per-file maximum, **When** uploaded,
   **Then** the system accepts and stores it in full.
3. **Given** a zero-byte file, **When** uploaded, **Then** the system accepts it and returns `201`
   with `size: 0`, not an error.
4. **Given** a request whose body is not a well-formed multipart upload, or that omits the
   `upload` field entirely, **When** the client calls `POST /files`, **Then** the system
   returns `400` with the standard error envelope.
5. **Given** a file whose size exceeds the configured per-file maximum, **When** uploaded,
   **Then** the system returns `413` without storing any part of the file.
6. **Given** the number of currently-stored files has reached the configured maximum, **When** a
   new file is uploaded, **Then** the system returns `409` with the standard error envelope,
   without storing the new file or evicting any existing one.

---

### User Story 2 - Download a File (Priority: P2)

A tester who previously uploaded a file requests it back by its identifier and confirms the
returned bytes, content type, and filename exactly match what was originally uploaded.

**Why this priority**: Download is the read counterpart to upload and is the second most direct
way testing tools verify round-trip file integrity; it depends only on a file having been
uploaded first.

**Independent Test**: Can be fully tested by uploading a file, then calling `GET /files/{id}` with
the returned identifier and confirming the response body byte-for-byte matches the uploaded
content, with the original content type and filename.

**Acceptance Scenarios**:

1. **Given** a previously uploaded file's identifier, **When** the client calls
   `GET /files/{id}`, **Then** the system returns `200` with the exact original bytes, the
   original `Content-Type`, and a `Content-Disposition` header naming the original filename.
2. **Given** a syntactically valid identifier that does not correspond to any stored file,
   **When** the client calls `GET /files/{id}`, **Then** the system returns `404` with the
   standard error envelope.
3. **Given** a malformed identifier (wrong format for the identifier scheme), **When** the client
   calls `GET /files/{id}`, **Then** the system returns `400` rather than a false `404`.
4. **Given** an identifier for a file that has since been deleted, **When** the client calls
   `GET /files/{id}`, **Then** the system returns `404`.

---

### User Story 3 - List Uploaded Files (Priority: P3)

A tester lists every file currently stored on the server to discover identifiers to use in
subsequent download or delete calls, without pulling any file's actual content.

**Why this priority**: Listing is how a caller discovers what exists without already knowing an
identifier; it depends on upload but is independent of download and delete.

**Independent Test**: Can be fully tested by uploading two or more files, calling `GET /files`,
and confirming every uploaded file's metadata appears in the paginated result with no other
file's raw content included.

**Acceptance Scenarios**:

1. **Given** no files have been uploaded, **When** the client calls `GET /files`, **Then** the
   system returns `200` with an empty `data` array inside the standard pagination envelope.
2. **Given** two or more previously uploaded files, **When** the client calls `GET /files`,
   **Then** the system returns `200` with each file's identifier, filename, content type, size,
   and upload timestamp — never the file's raw content — inside the standard pagination envelope.
3. **Given** more stored files than fit on one page, **When** the client calls `GET /files` with
   `page`/`limit` query parameters, **Then** the system returns the correct page of results —
   ordered newest-first by upload timestamp — with accurate pagination metadata (`total`,
   `totalPages`, `hasNext`, `hasPrevious`), identical across repeated calls against the same
   stored set.
4. **Given** an invalid `page` or `limit` value, **When** the client calls `GET /files`, **Then**
   the system returns `400` with the standard error envelope, consistent with every other paginated
   list endpoint in this project.

---

### User Story 4 - Delete a File (Priority: P4)

A tester removes a previously uploaded file by its identifier, freeing storage capacity, and
confirms it is no longer listed or downloadable.

**Why this priority**: Delete completes the upload/download/list/delete lifecycle and is the
mechanism a caller uses to stay under the configured storage cap from User Story 1; it depends on
a file already existing.

**Independent Test**: Can be fully tested by uploading a file, calling `DELETE /files/{id}` and
confirming `204`, then confirming a subsequent `GET /files/{id}` returns `404` and the file no
longer appears in `GET /files`.

**Acceptance Scenarios**:

1. **Given** a previously uploaded file's identifier, **When** the client calls
   `DELETE /files/{id}`, **Then** the system returns `204`, and the file is immediately absent from
   both `GET /files/{id}` and `GET /files`.
2. **Given** a syntactically valid identifier that does not correspond to any stored file,
   **When** the client calls `DELETE /files/{id}`, **Then** the system returns `404`.
3. **Given** an identifier already deleted once, **When** the client calls `DELETE /files/{id}`
   again for the same identifier, **Then** the system returns `404`, not a repeated `204` or a
   crash.
4. **Given** a malformed identifier, **When** the client calls `DELETE /files/{id}`, **Then** the
   system returns `400` rather than a false `404`.

---

### Edge Cases

- What happens when the multipart upload field is named something other than `upload`? The
  system MUST return `400` rather than silently ignoring the field or crashing.
- What happens when a filename contains characters that need encoding (spaces, non-ASCII, path
  separators)? The system MUST store and echo the filename safely, and MUST NOT interpret it as a
  filesystem path (no path traversal, since files are never written to disk).
- What happens when the client omits a content type for the uploaded file part? The system MUST
  fall back to a generic binary content type (`application/octet-stream`) rather than rejecting
  the upload or guessing incorrectly.
- What happens when two uploads race at exactly the configured storage-count maximum? At most one
  of the two MUST succeed; the system MUST NOT ever store more files than the configured maximum.
- What happens when a client uploads many small files back-to-back during a load test? Overall
  memory use MUST stay bounded by the configured per-file size limit multiplied by the configured
  maximum stored-file count — never unbounded.
- What happens when `GET /files/{id}` is called concurrently with `DELETE /files/{id}` for the
  same identifier? Each individual request MUST receive a consistent, correct result (either the
  full file or `404`), never a partial or corrupted body.

## Requirements *(mandatory)*

### Functional Requirements

**Upload**

- **FR-001**: System MUST expose `POST /files`, accepting a single file via a multipart/form-data
  upload under the field name `upload`, storing it in memory and returning `201` with the new
  file's identifier, original filename, content type, byte size, and upload timestamp.
- **FR-002**: System MUST reject a request whose body is not a well-formed multipart upload, or
  that omits the `upload` field, with `400`.
- **FR-003**: System MUST reject any single uploaded file exceeding a configurable per-file
  maximum size with `413`, without storing any part of the oversized file.
- **FR-004**: System MUST reject a new upload once the number of currently-stored files has
  reached a configurable maximum, returning `409` with the standard error envelope, and MUST NOT
  evict any existing file to make room.
- **FR-005**: System MUST accept a zero-byte file as valid, returning `201` with `size: 0`.
- **FR-006**: System MUST default a stored file's content type to a generic binary type when the
  uploaded part does not declare one, rather than rejecting the upload.

**Download**

- **FR-007**: System MUST expose `GET /files/{id}`, returning `200` with the exact original bytes,
  the stored `Content-Type`, and a `Content-Disposition` header carrying the original filename.
- **FR-008**: System MUST return `404` with the standard error envelope when `{id}` is
  syntactically valid but does not correspond to any currently-stored file (including a file that
  has been deleted).
- **FR-009**: System MUST return `400` with the standard error envelope when `{id}` is malformed
  for the identifier scheme, rather than returning a false `404`.

**List**

- **FR-010**: System MUST expose `GET /files`, returning `200` with each stored file's metadata
  (identifier, filename, content type, size, upload timestamp) — never a file's raw content —
  inside the project's standard pagination envelope, ordered by upload timestamp descending
  (newest first) by default, deterministically for a given stored set.
- **FR-011**: System MUST validate `page`/`limit` query parameters on `GET /files` using the same
  rules as every other paginated list endpoint in this project, returning `400` for invalid values.

**Delete**

- **FR-012**: System MUST expose `DELETE /files/{id}`, removing the identified file and returning
  `204` on success.
- **FR-013**: System MUST return `404` when `{id}` does not correspond to any currently-stored
  file, including on a repeated delete of an already-deleted identifier.
- **FR-014**: System MUST return `400` when `{id}` is malformed, rather than a false `404`.

**Cross-cutting**

- **FR-015**: Every response produced by this feature, success or error, MUST include the
  `X-Request-ID` header; every error body MUST embed the same request id in the standard error
  envelope.
- **FR-016**: The configurable per-file maximum size and maximum stored-file count introduced by
  this feature MUST be sourced from environment configuration, never hardcoded.
- **FR-017**: This feature MUST NOT perform any external network call or write to disk; all stored
  file content MUST reside in memory, bounded by the configured per-file size and stored-file
  count maximums, per the project's bounded-resource principle.
- **FR-018**: All file records introduced by this feature MUST be resettable to an empty store by
  the project's existing admin-reset mechanism once that mechanism exists.

### Key Entities

- **File**: A single uploaded artifact with a unique identifier, an original filename, a content
  type, a byte size, an upload timestamp, and its raw content — held entirely in memory for the
  life of the server process, with no disk persistence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A tester can complete an upload → download → list → delete cycle for a single file
  in four requests, with the downloaded content matching the uploaded content byte-for-byte 100%
  of the time.
- **SC-002**: 100% of uploads exceeding the configured per-file size maximum are rejected before
  any of the oversized content is stored, and 100% of uploads attempted while the store is at its
  configured maximum file count are rejected without evicting existing files.
- **SC-003**: 100% of `GET`/`DELETE` requests for a nonexistent or already-deleted file identifier
  return `404`, and 100% of requests using a malformed identifier return `400`, with zero crashes
  across repeated automated test runs.
- **SC-004**: A load test performing sustained uploads at or below the configured per-file and
  total-count maximums shows no unbounded growth in server memory usage.

## Assumptions

- **In-memory storage only, no disk writes**: consistent with the project's in-memory,
  no-external-database architecture; file content does not survive a server restart and is cleared
  by the admin-reset mechanism once Spec 011 introduces it (tracked as FR-018).
- **Multipart/form-data is the only supported upload mechanism**: a single file per `POST /files`
  request under the field name `upload` (confirmed in Clarifications above), matching CLAUDE.md's
  "multipart upload if practical" guidance while keeping upload scope bounded and testable; batch
  (multi-file) uploads and raw binary request bodies are out of scope for this spec.
- **Top-level paths, no `/api/v1` prefix**: `/files` is mounted top-level, mirroring the other
  protocol-level HTTP testing utilities from Spec 007 (`/delay`, `/payload`, `/content`,
  `/headers`, `/cookies`), since it is a generic testing utility rather than a domain resource like
  `users` or `products`.
- **No authentication required**: consistent with every other top-level testing-utility endpoint
  in this project (Spec 007's utilities, Spec 008's `/rate-limit` and `/flaky`).
- **File identifiers are UUIDs**: consistent with how other server-generated, non-sequential
  identifiers are modeled elsewhere in this project (e.g. the `payments` resource from Spec 003).
- **Two new environment variables**: `MAX_FILE_SIZE` (per-file maximum, bytes; default `2mb`) and
  `MAX_STORED_FILES` (maximum number of files held at once; default `50`) are added to
  configuration (confirmed in Clarifications above); neither existing `MAX_PAYLOAD_SIZE` nor any
  other current variable expresses a cumulative, cross-request storage cap, which this feature
  specifically needs to keep total memory use bounded (CLAUDE.md #24 and the project's
  bounded-resource principle) — worst-case in-memory usage stays around 100MB
  (`MAX_FILE_SIZE` × `MAX_STORED_FILES`).
- **A full store is a conflict, not a payload-size error**: reaching `MAX_STORED_FILES` is
  reported as `409` (a state conflict — the store has no room until an existing file is deleted),
  distinct from `413` which is reserved for a single file exceeding `MAX_FILE_SIZE`; this keeps the
  two rejection reasons distinguishable by status code as well as by error code.
- **`GET /files` has no caller-facing sort parameter**: its default and only order is descending
  by upload timestamp (newest first), confirmed in Clarifications above, chosen for determinism
  rather than left to insertion/storage order, which could vary by implementation.
