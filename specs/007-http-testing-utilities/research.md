# Phase 0 Research: HTTP Testing Utilities

All items below were resolvable from CLAUDE.md, the constitution, the existing Spec 001-006
codebase conventions, and the three decisions already recorded in spec.md's Clarifications
session. No `NEEDS CLARIFICATION` markers remain in the Technical Context.

## Decision 1: `MAX_PAYLOAD_SIZE` is wired into the global body-parser limit for the first time

**Decision**: Change `app.use(express.json())` (currently unbounded — it uses Express's built-in
100kb default, not `config.maxPayloadSize`) to
`app.use(express.json({ limit: config.maxPayloadSize, verify: captureRawBody }))`. Add `bytes`
(+ `@types/bytes`) as an explicit direct dependency to convert `config.maxPayloadSize`'s string
form (e.g. `"10mb"`) into a byte count wherever this spec needs to compare a caller-supplied
`size` against the same maximum.

**Rationale**: `.env.example` (Spec 001) already documents `MAX_PAYLOAD_SIZE` as "Upper bound on
request/response body size across the server," but no code ever actually passed it to
`express.json()` — every endpoint in Specs 001-006 has silently relied on Express's undocumented
100kb default instead. FR-009 (`POST /payload` must reject an oversized body with `413`) is the
first requirement that makes this gap directly observable, so fixing it at the global body-parser
level (rather than only for `/payload`) both satisfies FR-009 and closes a pre-existing,
previously-invisible gap for every other endpoint — a strict improvement with no behavior change
for any request that was already within the true intended limit. `bytes` is already an indirect
dependency of `body-parser`/Express itself (it's what Express uses internally to interpret the
`limit` option), so adding it directly costs nothing new in `node_modules`, only an explicit,
pinned reference.

**Alternatives considered**: leaving the global limit at Express's default and only enforcing
`MAX_PAYLOAD_SIZE` inside the `/payload` handler itself after full buffering (rejected — this
would require buffering the oversized body into memory before rejecting it, directly violating
FR-009's "without buffering the full oversized body into memory" and the constitution's
bounded-resource principle); a per-route `express.json({ limit })` applied only to `/payload`
(rejected — every other endpoint would remain unbounded, a worse outcome than fixing it globally
for zero extra cost).

## Decision 2: Exact request-body byte length via body-parser's `verify` hook, not re-serialization

**Decision**: Pass a `verify: (req, res, buf) => { req.rawBody = buf; }` callback to
`express.json()` (implemented in `src/middleware/rawBody.ts`, alongside a
`declare global { namespace Express { interface Request { rawBody?: Buffer } } }`
augmentation). `POST /payload`'s `contentLength` is `req.rawBody?.length ?? 0`.

**Rationale**: FR-007 requires the *exact* byte length of the request body as transmitted.
Re-serializing the already-parsed JSON object (`Buffer.byteLength(JSON.stringify(req.body))`)
would not reliably match the original bytes (insignificant whitespace, key order, or Unicode
normalization differences between what was sent and what `JSON.stringify` re-emits). Capturing
the raw buffer via `verify` — a standard `body-parser` extension point — guarantees exactness
without any re-parsing, and was confirmed by direct testing to report `0` for a genuinely empty
body (`Content-Length: 0`) and the exact byte count otherwise, including the case where a client
uses chunked transfer-encoding with no `Content-Length` header at all.

**Alternatives considered**: reading `req.headers['content-length']` directly (rejected — absent
or unreliable under chunked transfer-encoding, and requires a redundant string-to-number parse
the `verify` buffer already avoids); re-serializing `req.body` (rejected per above — not
guaranteed byte-exact).

## Decision 3: Body-parser's `PayloadTooLargeError` mapped to the standard envelope, `413`

**Decision**: Add one new branch to `src/middleware/errorHandler.ts`, structurally identical to
the existing `isJsonParseError` check: `isPayloadTooLargeError(err)` tests
`err instanceof Error && (err as any).type === "entity.too.large"`, and on a match responds `413`
with `buildErrorEnvelope("PAYLOAD_TOO_LARGE", ...)`.

**Rationale**: Confirmed by direct testing that `body-parser`'s over-limit rejection throws an
`Error` with `.status === 413`, `.type === "entity.too.large"`, `.name === "PayloadTooLargeError"`
— structurally parallel to the `SyntaxError`/`entity.parse.failed` shape the existing
`isJsonParseError` branch already handles. Without this new branch, an oversized body would fall
through to the generic `500` handler, which is both semantically wrong (a caller error, not a
server error) and inconsistent with this project's single documented error envelope (constitution
Principle III).

**Alternatives considered**: manually tracking body length in application code before Express's
own body-parser runs (rejected — reinvents what `body-parser`'s `limit` option already does
correctly and efficiently, at the cost of extra unnecessary code).

## Decision 4: Delay uses plain `setTimeout`, not `async`/`await`

**Decision**: `delay.controller.ts`'s handler is a synchronous (non-`async`) function. It
validates the requested delay (via `delay.service.ts`'s `resolveDelayMs`, which throws `HttpError`
synchronously on invalid input — caught normally by Express's synchronous dispatch), then calls
`setTimeout(() => res.status(200).json({ delayMs }), ms)` and returns immediately, letting the
timer's callback send the response later.

**Rationale**: This is the first endpoint in the codebase whose success path is inherently
asynchronous (every prior spec's handlers are fully synchronous). Express 4.x does **not**
automatically catch rejected promises returned from route handlers — an `async` handler that
threw before its first `await` would become an unhandled promise rejection instead of reaching
`errorHandler`, silently hanging the request. Structuring the handler as synchronous validation
followed by a plain callback-based `setTimeout` sidesteps this pitfall entirely: there is no
promise in the request-handling path for Express to fail to catch.

**Alternatives considered**: an `async` handler wrapped in a small `catchAsync`/`asyncHandler`
utility that forwards rejections to `next()` (rejected — correct, but adds a new
cross-cutting middleware-wrapping pattern to the codebase for a single endpoint's benefit, when a
plain synchronous-validation-then-`setTimeout` structure achieves the same safety with zero new
abstraction); a real `await new Promise(resolve => setTimeout(resolve, ms))` inside an `async`
handler (rejected for the same unhandled-rejection risk on the synchronous validation step, which
would need to move before the function became `async` anyway — at which point the plain
`setTimeout` callback form is simpler).

## Decision 5: Byte-exact payload generation via a measured filler string

**Decision**: `payload.service.ts`'s `generatePayload(targetBytes)` builds `{ size: targetBytes,
data: "" }`, measures `Buffer.byteLength(JSON.stringify(shell), "utf8")`, computes
`fillerLength = Math.max(0, targetBytes - shellBytes)`, and returns
`{ size: targetBytes, data: "a".repeat(fillerLength) }`. Because `data`'s filler characters are
plain ASCII `"a"` (no JSON-escaping, one byte each in UTF-8), the final
`JSON.stringify(...)` is **exactly** `targetBytes` bytes whenever `targetBytes >= shellBytes`
(FR-004, SC-002).

**Rationale**: Deterministic and dependency-free — no need for a padding/measurement library.
Using an escapable character (e.g. a quote or backslash) in the filler would break the
byte-exactness guarantee, since `JSON.stringify` would escape it into two bytes; plain `"a"` has
no such risk. For `targetBytes` smaller than the shell's own overhead (e.g. `size=0`), the
function returns the minimal shell with an empty `data` field rather than erroring — matching
spec.md's Edge Cases note that `size=0` must return `200` with an "empty or minimal body," not an
error.

**Alternatives considered**: padding with spaces inside a JSON string value (equivalent to `"a"`
for byte-exactness — either works; `"a"` was chosen only for readability in captured responses);
a binary/non-JSON response body sized by literally slicing a byte buffer (rejected — every other
JSON-based endpoint in this project returns `application/json`, and a non-JSON payload response
would be a needless inconsistency for a project whose primary format is JSON).

## Decision 6: Cookie reading — a hand-rolled parser, not the `cookie-parser` package

**Decision**: `src/utils/cookieHeader.ts` exports `parseCookieHeader(header: string | undefined):
Record<string, string>`, splitting the raw `Cookie` header on `"; "`, splitting each pair on the
first `"="`, and `decodeURIComponent`-ing each value — returning `{}` for a missing header, never
throwing. Cookie *setting* and *clearing* use Express's own built-in `res.cookie(name, value)` /
`res.clearCookie(name)` methods directly (no library needed — these ship with Express itself).

**Rationale**: Reading `req.headers.cookie` requires parsing, which Express does not do without
the separate `cookie-parser` middleware; but the parsing logic needed here is a handful of lines,
directly mirroring Spec 006's `parseBasicAuthHeader` (`src/auth/basicAuth.ts`) precedent of
hand-rolling small, single-purpose header parsers rather than adding a dependency for them.
`res.cookie()`/`res.clearCookie()` already URL-encode/decode and set sensible defaults (`Path=/`,
an already-expired `Set-Cookie` for `clearCookie`), so no library is needed for the write side
either.

**Alternatives considered**: adding the `cookie-parser` package (rejected — a well-known,
lightweight library, but unnecessary for a single-purpose header split/decode this codebase
already has a working precedent for hand-rolling); using `req.headers.cookie` directly without
any parsing and requiring the caller to pass a whole raw cookie string (rejected — defeats the
purpose of a name/value-oriented API and doesn't satisfy FR-014's "map of every cookie" shape).

## Decision 7: `DELETE /cookies` takes the name via `?name=` query, `POST /cookies` via a JSON body

**Decision**: `POST /cookies` accepts `{ "name": string, "value": string }` as a JSON body
(`cookieSetRequestSchema`, `.strict()`), matching every other `POST` endpoint in this project.
`DELETE /cookies` accepts `?name=` as a query parameter, not a body.

**Rationale**: HTTP `DELETE` request bodies are inconsistently sent and inconsistently parsed by
real-world HTTP clients and test tooling (many strip them entirely), so requiring one would make
this endpoint needlessly fragile to exercise from exactly the automated testing tools this
project targets. A query parameter is unambiguous and universally supported for `DELETE`. `POST`
keeps a body for consistency with the rest of the project's `POST` endpoints (login, token issue,
API key issue, etc.), which all accept a JSON body.

**Alternatives considered**: `DELETE /cookies` with a JSON body (rejected per above); `POST
/cookies` via query parameters instead of a body (rejected — would be the only `POST` endpoint in
the project not using a JSON body, an unnecessary inconsistency).

## Decision 8: Content-Type validation via Express's built-in `req.is(...)`

**Decision**: `content.service.ts`'s `validateContentType(req, type)` calls `req.is(mediaType)`
(Express's built-in content-type matcher, which handles `charset=...` suffixes and wildcard
matching correctly) for the expected media type of the given `type` path value, treating any
falsy result as a mismatch.

**Rationale**: `req.is()` is already a battle-tested part of Express's own `Request` prototype —
no new dependency, and it correctly strips parameters like `; charset=utf-8` that a naive string
comparison against `req.headers['content-type']` would mishandle.

**Alternatives considered**: manual string comparison against `req.headers['content-type']`
(rejected — would need to reimplement `req.is()`'s existing, correct parameter-stripping logic
for no benefit).

## Decision 9: HTML/XML demo bodies are hand-built template strings

**Decision**: `contentTypeDemos.catalog.ts` builds its `html` and `xml` example bodies as plain
TypeScript template literals — no XML-building or HTML-templating library.

**Rationale**: Each body is a small, fixed, deterministic example — a library would add
dependency weight for no benefit over a literal string, consistent with this project's pattern of
adding a dependency only when it earns its keep (e.g. `jsonwebtoken` for real JWT semantics, but
no such library for output this simple).

**Alternatives considered**: an XML-serialization library (rejected — pure overhead for a fixed,
never-parsed-by-this-server example string).

## Decision 10: Route mounting — top-level, outside `/api/v1`

**Decision**: `/delay`, `/payload`, `/content`, `/headers`, and `/cookies` all mount on their own
top-level routers in `src/app.ts`, alongside `authRouter`/`apiKeyRouter`/`basicAuthRouter` — not
under the versioned `apiRouter`.

**Rationale**: CLAUDE.md spells every one of these paths without the `/api/v1` prefix, exactly as
it does for Specs 005/006's auth-mechanism paths. Matches established precedent rather than
normalizing every endpoint under one prefix.

**Alternatives considered**: mounting under `/api/v1` for consistency with CRUD resources
(rejected — would contradict CLAUDE.md's explicit path list and Specs 005/006's precedent).
