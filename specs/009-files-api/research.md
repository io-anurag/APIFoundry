# Phase 0 Research: Files API

All items below were resolvable from CLAUDE.md, the constitution, the existing Spec 001-008
codebase conventions, and the three decisions already recorded in spec.md's Clarifications
session. No `NEEDS CLARIFICATION` markers remain in the Technical Context.

## Decision 1: Multipart parsing via `multer` (memory storage), field name `upload`, one new dependency

**Decision**: Add `multer` (+ `@types/multer`) as a new dependency. `src/routes/files.routes.ts`
configures `multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSizeBytes } })`
and mounts `upload.single("upload")` ahead of the `POST /files` controller. `maxFileSizeBytes` is
computed once at module load via `bytes.parse(config.maxFileSize)` (the same `bytes` package
Spec 007 already uses for `MAX_PAYLOAD_SIZE`).

**Rationale**: This project has no existing multipart-parsing code, and hand-rolling a
multipart/form-data parser (unlike the ~6-line `mulberry32` PRNG Spec 008 hand-rolled) would
reimplement a well-specified, error-prone wire format for no benefit — CLAUDE.md's own wording
("multipart upload if practical") signals a real library is expected here. `multer` is the
de facto standard for Express, actively maintained, and its `memoryStorage` engine gives a
`Buffer` directly (`req.file.buffer`), matching this feature's in-memory-only storage
requirement (FR-017) with no temp-file cleanup to manage. Enforcing the per-file size cap via
`limits.fileSize` rejects an oversized upload mid-stream (multer/busboy stops reading further
bytes once the limit is hit) rather than buffering the whole oversized body first, which is more
resource-bounded than checking `req.file.buffer.length` only after a full read.

**Alternatives considered**: hand-rolling a multipart parser (rejected — reimplements RFC 7578
parsing for no behavioral gain, and is far more likely to contain edge-case bugs than a mature
library); `busboy` directly (multer's own dependency) (rejected — multer already wraps it with
Express-idiomatic middleware, `req.file`/`req.body` population, and per-file size limits, so
using busboy directly would just re-implement multer's own glue code); `formidable` (rejected —
not an Express-idiomatic middleware, would need the same amount of custom glue as busboy, and
this project's other single-purpose choices, e.g. `bytes` for size parsing, already lean on
small, focused, widely-used packages rather than introducing a second, larger alternative).

## Decision 2: Multer/busboy errors are translated centrally in `errorHandler.ts`, alongside the existing body-parser cases

**Decision**: `errorHandler.ts` gains one more `instanceof` check, using `MulterError` imported
from `multer`: `err.code === "LIMIT_FILE_SIZE"` → `413 FILE_TOO_LARGE`; any other `MulterError`
(e.g. `LIMIT_UNEXPECTED_FILE` from a wrongly-named field) → `400 VALIDATION_ERROR`. This sits
alongside the existing `isJsonParseError`/`isPayloadTooLargeError` checks, in the same
if-chain-of-library-error-shapes style already established there.

**Rationale**: `errorHandler.ts` already exists specifically to translate library-thrown,
non-`HttpError` shapes (a `ZodError`, body-parser's `PayloadTooLargeError`, a JSON
`SyntaxError`) into the standard error envelope in one place, rather than scattering
try/catch translation logic across every route. `MulterError` is exactly one more
library-error shape of the same kind — handling it here keeps that single point of translation
intact instead of adding a second, route-local mechanism.

**Alternatives considered**: wrapping `upload.single("upload")` in a local
try/catch-equivalent inside `files.routes.ts` that calls `next(new HttpError(...))` itself
(rejected — duplicates the translation responsibility `errorHandler.ts` already owns for every
other library error shape in this project, for no added benefit).

## Decision 3: Files are stored in a UUID-keyed `createKeyedStore<FileRecord>()`, with a capacity check before create

**Decision**: `src/data/files.store.ts` exports `fileStore = createKeyedStore<FileRecord>()`.
`file.service.ts`'s `uploadFile(...)` first checks `fileStore.list().length >= config.maxStoredFiles`;
if so, throws `HttpError(409, "STORAGE_LIMIT_EXCEEDED", ...)` without ever calling `create()`.
Otherwise it builds a new record with `id: randomUUID()` and calls `fileStore.create(record)` —
identical shape to how `payment.service.ts` creates a new `Payment` (Spec 003/008).

**Rationale**: `createKeyedStore` already provides exactly the `get`/`create`/`remove`/`list`/
`reset` operations this feature needs for a UUID-identified collection — no new store
abstraction is justified, consistent with Spec 008's Decision 1 reusing it rather than
hand-rolling a `Map`. Checking capacity before `create()` (rather than, say, an eviction
policy) matches FR-004's explicit "MUST NOT evict any existing file to make room."

**Alternatives considered**: an LRU/FIFO eviction policy that silently deletes the oldest file
to make room for a new upload (rejected — spec.md's Clarifications/Assumptions explicitly reject
eviction in favor of a deterministic `409`, since silent eviction would make a test's own earlier
upload vanish unpredictably); tracking a separate running byte-count instead of `list().length`
(rejected — the clarified `MAX_STORED_FILES` config is a file *count* cap, not a byte-total cap;
the per-file `MAX_FILE_SIZE` cap already bounds the worst case cumulative bytes as documented in
spec.md's Assumptions).

## Decision 4: A monotonic `sequence` field breaks ties for deterministic newest-first ordering

**Decision**: `FileRecord` carries an internal `sequence: number` field — a module-level counter
in `files.store.ts` incremented on every `create()` — in addition to `uploadedAt`. `file.service.ts`'s
`listFiles(...)` sorts by `sequence` descending (not by comparing `uploadedAt` strings) before
paginating.

**Rationale**: The Clarifications session fixed `GET /files`'s default order as "descending by
upload time, deterministically." `uploadedAt` is an ISO timestamp with millisecond resolution;
two uploads submitted in quick succession (exactly the kind of back-to-back calls an automated
test performs) can land in the same millisecond, making a string/date comparison alone
non-deterministic for same-millisecond uploads (the ordering between them would depend on
whatever order the sort algorithm happens to leave equal keys in). A dedicated, strictly
increasing `sequence` counter has no such collision risk and costs one extra integer field.

**Alternatives considered**: sorting by `uploadedAt` string comparison alone (rejected — ties are
possible at millisecond resolution, undermining the "deterministically" requirement from
Clarifications); using higher-resolution timestamps (e.g. `process.hrtime`) instead of a counter
(rejected — still theoretically collidable and more complex than an integer increment that is
collision-proof by construction).

## Decision 5: No caller-facing `sort` parameter; `page`/`limit` reuse the shared `parseListQuery` validator

**Decision**: `file.service.ts`'s `listFiles(rawQuery)` calls
`parseListQuery(rawQuery, { allowedSortFields: [] })`, using only the returned `page`/`limit`
(validated with the exact same rules — defaults, bounds, `400` on invalid values — as every
other paginated resource) and discarding `query.sort` entirely; the newest-first order from
Decision 4 is applied unconditionally in the service, not driven by the query string.

**Rationale**: FR-011 requires `page`/`limit` to be validated identically to every other list
endpoint in the project — reusing `parseListQuery` gets that for free with no new code. Passing
an empty `allowedSortFields` list means any caller-supplied `?sort=` value is rejected with the
same `400 VALIDATION_ERROR` shape callers already see from other resources when they name an
invalid sort field, which is a reasonable, unsurprising response for a resource that documents
no sort parameter at all (spec.md Assumptions: "`GET /files` has no caller-facing sort
parameter").

**Alternatives considered**: silently ignoring an unrecognized `sort` value instead of rejecting
it (rejected — inconsistent with how every other list endpoint in this project treats an
unrecognized `sort` field, and would require a bespoke query-parsing path just for this one
resource).

## Decision 6: Missing content type on the uploaded part falls back to `application/octet-stream`

**Decision**: `file.service.ts` reads `contentType = req.file.mimetype || "application/octet-stream"`
before storing the record.

**Rationale**: `busboy` (via `multer`) already reports whatever `Content-Type` the client declared
on the multipart file part, defaulting to `application/octet-stream` itself in the common case
where a client omits one — but relying on an explicit fallback in this project's own code (rather
than trusting a transitive dependency's default forever) keeps FR-006 correct and self-documenting
even if the parsing library's own default ever changed.

**Alternatives considered**: attempting to sniff the content type from the file's bytes or its
filename extension (rejected — adds real complexity and a new dependency for a case CLAUDE.md
doesn't ask for; a generic binary fallback is simplest and matches FR-006's literal requirement).

## Decision 7: Filenames are sanitized before being placed in the `Content-Disposition` response header

**Decision**: `file.service.ts`/`file.controller.ts` builds the download response's
`Content-Disposition` header via a new `buildContentDisposition(filename)` utility
(`src/utils/contentDisposition.ts`) that (a) strips any CR/LF and other C0 control characters
from the filename before use, and (b) emits both an ASCII-safe quoted `filename="..."` (with
internal `"` characters escaped) and an RFC 6266 `filename*=UTF-8''...` (percent-encoded)
parameter, so non-ASCII names round-trip correctly in modern clients while older clients still
get a safe ASCII fallback.

**Rationale**: This is a security-relevant boundary — a filename is fully caller-controlled
input that flows directly into an HTTP response header. Node's `http` module already rejects raw
CR/LF in a header value (throwing rather than allowing header/response splitting), which would
otherwise turn a crafted filename into an unhandled `500`, violating the constitution's
fail-safe-handling principle (Principle III) and CLAUDE.md's edge-case requirement that a
filename needing encoding must be handled safely (spec.md Edge Cases). Stripping control
characters up front avoids that crash entirely, and the dual ASCII/UTF-8 parameter form is the
standard, widely-supported way to carry an arbitrary filename in this header.

**Alternatives considered**: passing the filename through unmodified (rejected — a filename
containing `\r\n` would crash the process on that response, an unacceptable fail-safe-handling
violation); rejecting uploads with "unsafe" filenames at upload time instead of sanitizing at
download time (rejected — would reject otherwise-legitimate non-ASCII filenames CLAUDE.md's edge
case explicitly expects to be accepted and "stored and echoed... safely," not refused).

## Decision 8: Route mounting — `/files` and `/files/{id}` are top-level, unauthenticated; two new env vars

**Decision**: `filesRouter` mounts top-level in `src/app.ts`, alongside `delayRouter`/
`payloadRouter`/.../`cacheRouter` from Specs 007-008 (no `/api/v1` prefix, no auth middleware).
`src/config/env.schema.ts` gains `MAX_FILE_SIZE: z.string().min(1).default("2mb")` (parsed the
same way `MAX_PAYLOAD_SIZE` already is, via the `bytes` package) and
`MAX_STORED_FILES: numeric(z.number().int().positive()).default(50)`; both are threaded through
`ConfigurationProfile`/`loadConfig` in `src/config/index.ts` and documented in `.env.example`
immediately after `MAX_PAYLOAD_SIZE`.

**Rationale**: Confirmed in spec.md's Assumptions — `/files` is a generic testing utility like
`/delay`/`/payload`/`/cookies`, not a domain resource, matching CLAUDE.md's bare-path spelling
and every prior HTTP-testing-utility spec's precedent. `MAX_FILE_SIZE` as a `bytes`-parseable
string (rather than a raw integer) matches the existing `MAX_PAYLOAD_SIZE` convention for the
same kind of size-cap value, so `.env.example` reads consistently (`10mb`, `2mb`) rather than
mixing string and raw-byte-count conventions for near-identical settings.

**Alternatives considered**: mounting `/files` under `/api/v1` (rejected — contradicts CLAUDE.md's
bare-path spelling and Spec 007/008's established precedent for identically-shaped generic
utilities); expressing `MAX_FILE_SIZE` as a raw integer byte count instead of a `bytes` string
(rejected — inconsistent with `MAX_PAYLOAD_SIZE`'s existing, already-documented string
convention for the same class of setting).
