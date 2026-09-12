---

description: "Task list template for feature implementation"
---

# Tasks: HTTP Testing Utilities

**Input**: Design documents from `/specs/007-http-testing-utilities/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/http-testing-utilities.openapi.yaml](contracts/http-testing-utilities.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations and the constitution's Quality Gates
("new or changed endpoints MUST include corresponding automated test coverage ... before being
considered done") make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story. Unlike prior specs, this feature's six user stories
(delay, payload generation, payload echo, content types, headers, cookies) are almost entirely
independent of one another — the only cross-story coupling is that User Story 3 (payload echo)
extends the same `payload.service.ts`/`payload.controller.ts`/`payload.routes.ts` files User
Story 2 (payload generation) creates, because both live under the same `/payload` path family.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1-US6)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-006 layout. No new top-level directories. Only two shared, cross-cutting files are modified:
`src/app.ts` (body-parser options + route mounting) and `src/middleware/errorHandler.ts` (one new
`413` branch) — no Spec 002-006 resource/feature file is touched.

---

## Phase 1: Setup

**Purpose**: The one new dependency this feature needs.

- [X] T001 Add `bytes` and `@types/bytes` to `package.json` (dependencies and devDependencies
      respectively) and run `npm install` (research.md Decision 1 — already an indirect
      dependency of `body-parser`/Express; added explicitly to convert `config.maxPayloadSize`'s
      string form, e.g. `"10mb"`, into a byte count for the `GET /payload?size=` bound check).

**Checkpoint**: Dependency available for Foundational and User Story 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Closes a pre-existing gap (`MAX_PAYLOAD_SIZE` was never wired into the actual
body-parser limit) that both User Story 2's bound-check and User Story 3's `413` behavior depend
on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create `src/middleware/rawBody.ts` (depends on T001): augment Express via
      `declare global { namespace Express { interface Request { rawBody?: Buffer } } }`; export
      `captureRawBody(req: Request, _res: Response, buf: Buffer): void` — sets `req.rawBody =
      buf` (research.md Decision 2 — a `body-parser`/`express.json()` `verify` callback used to
      capture the exact raw request-body bytes before JSON parsing, so `POST /payload`'s
      `contentLength` never depends on re-serializing the parsed body).
- [X] T003 Update `src/app.ts` (depends on T002): change `app.use(express.json())` to
      `app.use(express.json({ limit: config.maxPayloadSize, verify: captureRawBody }))`, importing
      `captureRawBody` from `./middleware/rawBody` (research.md Decision 1 — this is the first
      time `MAX_PAYLOAD_SIZE` is actually enforced anywhere in the app; every existing Spec
      002-006 endpoint's behavior for requests within the true intended limit is unchanged, only
      requests that were already over the *intended* limit and previously slipped through
      Express's undocumented 100kb default now correctly fail).
- [X] T004 Update `src/middleware/errorHandler.ts` (depends on T003): add a new branch, placed
      alongside the existing `isJsonParseError` check, structurally identical to it —
      `isPayloadTooLargeError(err)` returns true when `err instanceof Error && (err as { type?:
      string }).type === "entity.too.large"`; on a match, respond `413` via
      `buildErrorEnvelope("PAYLOAD_TOO_LARGE", "Request body exceeds the maximum allowed size",
      requestId, { limit: config.maxPayloadSize })` (research.md Decision 3 — confirmed by direct
      testing that `body-parser`'s over-limit rejection is `err.status === 413`, `err.type ===
      "entity.too.large"`, `err.name === "PayloadTooLargeError"`).

**Checkpoint**: Foundation ready — every endpoint in the app (not just this feature's) now
respects `MAX_PAYLOAD_SIZE`, and oversized bodies get the standard error envelope; user story
implementation can now begin.

---

## Phase 3: User Story 1 - Simulate Response Delay (Priority: P1) 🎯 MVP

**Goal**: `GET /delay/{ms}` and `GET /delay?ms=` wait the requested number of milliseconds before
responding, bounded by `MAX_DELAY_MS`.

**Independent Test**: Request a small delay and measure the response arrives no sooner than
requested; request a delay over the configured maximum and confirm immediate rejection. See
quickstart.md Scenario 1.

### Implementation for User Story 1

- [X] T005 [P] [US1] Create `src/utils/delayMsParam.ts`: `parseDelayMsParam(raw: unknown, maxMs:
      number): number` — following the existing `idParam.ts`/`statusCodeParam.ts` parse-or-throw
      style: `raw` must match `^\d+$` (rejects non-numeric, negative, decimal, empty, and
      whitespace-padded values in one shot); the parsed integer must be `<= maxMs`; either failure
      throws `HttpError(400, "VALIDATION_ERROR", ...)` (FR-002, FR-003).
- [X] T006 [US1] Create `src/services/delay.service.ts` (depends on T005): `resolveDelayMs(req:
      Request): number` — reads `req.params.ms ?? req.query.ms` and passes it to
      `parseDelayMsParam(value, config.maxDelayMs)`, returning the validated delay.
- [X] T007 [US1] Create `src/controllers/delay.controller.ts` (depends on T006): `getDelay(req,
      res)` — a **non-`async`** function (research.md Decision 4): calls `const ms =
      delayService.resolveDelayMs(req)` synchronously (any `HttpError` propagates normally through
      Express's synchronous dispatch), then `setTimeout(() => res.status(200).json({ delayMs: ms
      }), ms)` and returns — no `await`, no promise in the request-handling path.
- [X] T008 [US1] Create `src/routes/delay.routes.ts` (depends on T007): `export const delayRouter
      = Router({ strict: true });` mount `GET /delay/:ms` and `GET /delay` both to
      `delayController.getDelay`; `methodNotAllowedHandler` for each path (following the existing
      `user.routes.ts`-style convention of registering every real method before the catch-all).
- [X] T009 [US1] Wire `delayRouter` into `src/app.ts` (depends on T008): mount it top-level
      (alongside `authRouter`/`apiKeyRouter`/`basicAuthRouter`), matching CLAUDE.md's `/delay`
      path spelling (no `/api/v1` prefix).
- [X] T010 [P] [US1] Create `tests/delay.test.ts` (depends on T009) covering spec.md User Story
      1's acceptance scenarios 1-5: `GET /delay/50` → `200` with `{ delayMs: 50 }` no sooner than
      50ms elapsed; `GET /delay?ms=50` → identical behavior; `GET /delay/0` → `200` immediately;
      `GET /delay/{value greater than config.maxDelayMs}` → `400` returned near-instantly (assert
      elapsed time is small, not close to the requested value); non-numeric, negative, decimal,
      empty, and whitespace-padded `ms` values (both path and query form) → `400`.

**Checkpoint**: User Story 1 fully functional and independently testable (quickstart.md
Scenario 1).

---

## Phase 4: User Story 2 - Generate Bounded Response Payloads (Priority: P2)

**Goal**: `GET /payload/{small|medium|large}` and `GET /payload?size=` return a generated body of
the requested size, bounded by `MAX_PAYLOAD_SIZE`.

**Independent Test**: Request each preset and an explicit in-bounds size and confirm the response
body's byte length matches; request an over-maximum size and confirm rejection. See quickstart.md
Scenario 2.

### Implementation for User Story 2

- [X] T011 [P] [US2] Create `src/data/payloadPresets.catalog.ts`: `export const
      PAYLOAD_SIZE_PRESETS = ["small", "medium", "large"] as const;` and `export type
      PayloadSizePreset = (typeof PAYLOAD_SIZE_PRESETS)[number];`; `export const
      PAYLOAD_SIZE_PRESET_BYTES: Record<PayloadSizePreset, number> = { small: 1_024, medium:
      102_400, large: 1_048_576 };` — the exact byte values confirmed in spec.md's Clarifications
      session (data-model.md).
- [X] T012 [P] [US2] Create `src/utils/payloadPresetParam.ts` (depends on T011):
      `parsePayloadPresetParam(raw: string): PayloadSizePreset` — throws `HttpError(400,
      "VALIDATION_ERROR", ...)` when `raw` is not exactly one of `PAYLOAD_SIZE_PRESETS` (FR-006).
- [X] T013 [P] [US2] Create `src/utils/payloadSizeParam.ts`: `parsePayloadSizeParam(raw: unknown,
      maxBytes: number): number` — `raw` must match `^\d+$` (rejects non-numeric, negative,
      decimal, empty values in one shot); the parsed integer must be `<= maxBytes`; either failure
      throws `HttpError(400, "VALIDATION_ERROR", ...)` (FR-005, FR-006).
- [X] T014 [US2] Create `src/services/payload.service.ts` (depends on T011, T012, T013):
      `generatePayload(targetBytes: number): { size: number; data: string }` — builds `{ size:
      targetBytes, data: "" }`, computes `shellBytes = Buffer.byteLength(JSON.stringify(shell),
      "utf8")`, `fillerLength = Math.max(0, targetBytes - shellBytes)`, returns `{ size:
      targetBytes, data: "a".repeat(fillerLength) }` (research.md Decision 5, verbatim — this
      makes the final `JSON.stringify(...)` output exactly `targetBytes` bytes whenever
      `targetBytes >= shellBytes`). `getPayloadByPreset(rawPreset: string)` — parses via
      `parsePayloadPresetParam`, looks up `PAYLOAD_SIZE_PRESET_BYTES[preset]`, calls
      `generatePayload`. `getPayloadBySize(rawSize: unknown)` — parses via
      `parsePayloadSizeParam(rawSize, bytes(config.maxPayloadSize))` (using the new `bytes`
      dependency from T001), calls `generatePayload`.
- [X] T015 [US2] Create `src/controllers/payload.controller.ts` (depends on T014):
      `getPayloadByPreset(req, res)` → `res.status(200).json(payloadService
      .getPayloadByPreset(req.params.preset))`; `getPayloadBySize(req, res)` → `res.status(200)
      .json(payloadService.getPayloadBySize(req.query.size))`.
- [X] T016 [US2] Create `src/routes/payload.routes.ts` (depends on T015): `export const
      payloadRouter = Router({ strict: true });` mount `GET /payload/:preset` →
      `payloadController.getPayloadByPreset` with its own `methodNotAllowedHandler` immediately
      after (this path is only ever touched by this story, so its catch-all is complete here);
      mount `GET /payload` → `payloadController.getPayloadBySize` — **do NOT** add a
      `.all("/payload", methodNotAllowedHandler)` catch-all yet, since User Story 3 (T021) still
      needs to add `POST /payload` to this same exact path before the catch-all can be registered
      (adding it now would incorrectly reject that later `POST`, mirroring `user.routes.ts`'s
      convention of registering every real method on a path before its one catch-all).
- [X] T017 [US2] Wire `payloadRouter` into `src/app.ts` (depends on T016): mount it top-level
      (alongside `delayRouter`), matching CLAUDE.md's `/payload` path spelling (no `/api/v1`
      prefix).
- [X] T018 [P] [US2] Create `tests/payload.test.ts` (depends on T017) covering spec.md User Story
      2's acceptance scenarios 1-5: `GET /payload/small` → `200` with a response body whose byte
      length is exactly `1024`; `GET /payload/medium` → exactly `102400`; `GET /payload/large` →
      exactly `1048576`; `GET /payload?size=2048` → exactly `2048` bytes; `GET
      /payload?size={value greater than bytes(config.maxPayloadSize)}` → `400`; `GET
      /payload/huge` (undocumented preset) → `400`; `GET /payload?size=-1` and
      `GET /payload?size=abc` → `400`; `GET /payload?size=0` → `200` with a minimal body, not an
      error (Edge Cases).

**Checkpoint**: User Stories 1 and 2 both work independently (quickstart.md Scenario 2).

---

## Phase 5: User Story 3 - Echo Request Payloads (Priority: P3)

**Goal**: `POST /payload` reports the exact byte length of the request body it received, rejecting
malformed JSON with `400` and oversized bodies with `413`.

**Independent Test**: Post bodies of increasing size and shape and confirm the reported
`contentLength` matches exactly; post malformed JSON and an oversized body and confirm rejection.
See quickstart.md Scenario 3.

> **Note**: The `413` behavior itself was already built in Foundational (T002-T004); this story's
> own work is the `contentLength`-reporting endpoint plus the test coverage that verifies both
> behaviors end-to-end.

### Implementation for User Story 3

- [X] T019 [US3] Extend `src/services/payload.service.ts` (depends on T014, T002) with
      `echoPayload(req: Request): { received: true; contentLength: number }` — returns `{
      received: true, contentLength: req.rawBody?.length ?? 0 }` (research.md Decision 2; `?? 0`
      covers a genuinely empty body, confirmed by direct testing to leave `req.rawBody`
      `undefined` rather than a zero-length buffer).
- [X] T020 [US3] Extend `src/controllers/payload.controller.ts` (depends on T019, T015) with
      `postPayload(req, res)` → `res.status(200).json(payloadService.echoPayload(req))`.
- [X] T021 [US3] Extend `src/routes/payload.routes.ts` (depends on T020, T016) with `POST
      /payload` → `payloadController.postPayload`, inserted **before** the path's catch-all;
      immediately after it, add `payloadRouter.all("/payload", methodNotAllowedHandler)` — this is
      the first point both `GET` and `POST` exist on `/payload`, so this is where the catch-all
      for the exact `/payload` path finally belongs.
- [X] T022 [P] [US3] Extend `tests/payload.test.ts` (depends on T018) with spec.md User Story 3's
      acceptance scenarios 1-5 and Edge Cases: a small JSON object body → `200` with
      `contentLength` equal to the exact byte length of the request body sent; a large JSON body
      within the configured maximum → `200` with the correct `contentLength`; a deeply nested
      object and a top-level array body → `200` with the correct `contentLength` for each; a body
      that is not valid JSON (e.g. `'{not valid json'`) → `400`; an empty body → `200` with
      `contentLength: 0`; a body larger than `config.maxPayloadSize` → `413` (verifying
      Foundational T002-T004 end-to-end through this real endpoint).

**Checkpoint**: User Stories 1, 2, and 3 all work independently (quickstart.md Scenario 3).

---

## Phase 6: User Story 4 - Demonstrate Content Types (Priority: P4)

**Goal**: `GET /content/{json|text|html|xml}` returns each content type correctly; `POST
/content/{type}` validates the request's `Content-Type` header against that type's expected media
type.

**Independent Test**: Request each of the four types and confirm the correct `Content-Type`
header and body; post to the same paths with a mismatched `Content-Type` and confirm rejection.
See quickstart.md Scenario 4.

### Implementation for User Story 4

- [X] T023 [P] [US4] Create `src/data/contentTypeDemos.catalog.ts`: `export const CONTENT_TYPES =
      ["json", "text", "html", "xml"] as const;` and `export type ContentType = (typeof
      CONTENT_TYPES)[number];`; `export const CONTENT_TYPE_DEMOS: Record<ContentType, { mediaType:
      string; buildBody: () => string | object }>` — `json` → `mediaType: "application/json"`,
      `buildBody` returns a fixed, deterministic object; `text` → `mediaType: "text/plain"`,
      `buildBody` returns a fixed string; `html` → `mediaType: "text/html"`, `buildBody` returns a
      fixed, well-formed HTML document string; `xml` → `mediaType: "application/xml"`,
      `buildBody` returns a fixed, well-formed XML document string (data-model.md; research.md
      Decision 9 — plain template-literal strings, no XML/HTML library).
- [X] T024 [P] [US4] Create `src/utils/contentTypeParam.ts` (depends on T023):
      `parseContentTypeParam(raw: string): ContentType` — throws `HttpError(400,
      "VALIDATION_ERROR", ...)` when `raw` is not exactly one of `CONTENT_TYPES` (FR-011).
- [X] T025 [US4] Create `src/services/content.service.ts` (depends on T023, T024):
      `getContentDemo(rawType: string): { type: ContentType; mediaType: string; body: string |
      object }` — parses via `parseContentTypeParam`, looks up `CONTENT_TYPE_DEMOS`, calls
      `buildBody()`. `validateContentType(req: Request, rawType: string): ContentType` — parses
      `rawType` via `parseContentTypeParam`, then throws `HttpError(415,
      "UNSUPPORTED_MEDIA_TYPE", ...)` unless `req.is(CONTENT_TYPE_DEMOS[type].mediaType)` is
      truthy (research.md Decision 8 — Express's built-in content-type matcher; FR-012).
- [X] T026 [US4] Create `src/controllers/content.controller.ts` (depends on T025): `getContent(req,
      res)` → looks up the demo via `contentService.getContentDemo(req.params.type)`, then
      `res.type(demo.mediaType).send(typeof demo.body === "string" ? demo.body :
      JSON.stringify(demo.body))` for `text`/`html`/`xml`, or `res.status(200).json(demo.body)`
      for `json` (so the `Content-Type` and body shape are both correct per FR-010).
      `postContent(req, res)` → `const type = contentService.validateContentType(req,
      req.params.type); res.status(200).json({ accepted: true, type })`.
- [X] T027 [US4] Create `src/routes/content.routes.ts` (depends on T026): `export const
      contentRouter = Router({ strict: true });` mount `GET /content/:type` →
      `contentController.getContent` and `POST /content/:type` →
      `contentController.postContent`, then `methodNotAllowedHandler` (both methods exist on this
      path from the start, so the catch-all is complete in this one task).
- [X] T028 [US4] Wire `contentRouter` into `src/app.ts` (depends on T027): mount it top-level,
      matching CLAUDE.md's `/content` path spelling (no `/api/v1` prefix).
- [X] T029 [P] [US4] Create `tests/content.test.ts` (depends on T028) covering spec.md User Story
      4's acceptance scenarios 1-7: `GET /content/json` → `200`, `Content-Type:
      application/json`, valid JSON body; `GET /content/text` → `200`, `Content-Type: text/plain`;
      `GET /content/html` → `200`, `Content-Type: text/html`; `GET /content/xml` → `200`,
      `Content-Type: application/xml`; `GET /content/csv` (undocumented type) → `400`; `POST
      /content/json` with `Content-Type: application/json` → `200` with `{ accepted: true, type:
      "json" }`; `POST /content/json` with `Content-Type: text/plain` → `415`.

**Checkpoint**: User Stories 1-4 all work independently (quickstart.md Scenario 4).

---

## Phase 7: User Story 5 - Echo Safe Request Headers (Priority: P5)

**Goal**: `GET /headers` echoes every incoming header except `Authorization`, `Cookie`, and
`X-API-Key`.

**Independent Test**: Send a mix of ordinary and sensitive headers and confirm the response
includes the ordinary ones and excludes the sensitive ones. See quickstart.md Scenario 5.

### Implementation for User Story 5

- [X] T030 [P] [US5] Create `src/services/headers.service.ts`: `const SENSITIVE_HEADER_NAMES =
      ["authorization", "cookie", "x-api-key"] as const;` (Node.js already lowercases incoming
      header names, so a direct lowercase match suffices); `getSafeHeaders(req: Request):
      Record<string, string | string[]>` — returns every entry of `req.headers` whose key is
      **not** in `SENSITIVE_HEADER_NAMES` (data-model.md, FR-013).
- [X] T031 [US5] Create `src/controllers/headers.controller.ts` (depends on T030): `getHeaders(req,
      res)` → `res.status(200).json({ headers: headersService.getSafeHeaders(req) })`.
- [X] T032 [US5] Create `src/routes/headers.routes.ts` (depends on T031): `export const
      headersRouter = Router({ strict: true });` mount `GET /headers` →
      `headersController.getHeaders`; `methodNotAllowedHandler` for other methods.
- [X] T033 [US5] Wire `headersRouter` into `src/app.ts` (depends on T032): mount it top-level,
      matching CLAUDE.md's `/headers` path spelling (no `/api/v1` prefix).
- [X] T034 [P] [US5] Create `tests/headers.test.ts` (depends on T033) covering spec.md User Story
      5's acceptance scenarios 1-3: a request with several ordinary custom headers → `200` with
      those headers and values present exactly as sent; a request including `Authorization`,
      `Cookie`, and `X-API-Key` → `200` with none of those three keys anywhere in the response
      body; a request with no custom headers → `200` with whatever safe default headers the test
      client sent (e.g. `host`, `user-agent`, `accept`), never an error.

**Checkpoint**: User Stories 1-5 all work independently (quickstart.md Scenario 5).

---

## Phase 8: User Story 6 - Manage Cookies (Priority: P6)

**Goal**: `GET`/`POST`/`DELETE /cookies` set, read, and clear an arbitrary number of
independently-named cookies.

**Independent Test**: Set a cookie, confirm it (and a second, independently-set cookie) are
readable, clear one, and confirm only it disappears. See quickstart.md Scenario 6.

### Implementation for User Story 6

- [X] T035 [P] [US6] Create `src/utils/cookieHeader.ts`: `parseCookieHeader(header: string |
      undefined): Record<string, string>` — returns `{}` if `header` is missing; otherwise splits
      on `"; "`, splits each pair on the first `"="`, and `decodeURIComponent`-decodes each value,
      collecting the results into a plain object; never throws (research.md Decision 6).
- [X] T036 [P] [US6] Create `src/models/cookieRequests.ts`: `cookieSetRequestSchema` (zod: `name:
      z.string().min(1)`, `value: z.string()`, `.strict()`) — matches data-model.md's validation
      rules and `contracts/http-testing-utilities.openapi.yaml`'s `CookieSetRequest` schema
      exactly (FR-017).
- [X] T037 [US6] Create `src/services/cookies.service.ts` (depends on T035, T036):
      `listCookies(req: Request): Record<string, string>` → `parseCookieHeader(req.headers
      .cookie)`. `setCookie(res: Response, name: string, value: string): void` → `res.cookie(name,
      value)` (Express's own built-in method — no library needed, research.md Decision 6).
      `clearCookie(res: Response, name: string): void` → `res.clearCookie(name)`.
      `parseCookieName(raw: unknown): string` — throws `HttpError(400, "VALIDATION_ERROR", ...)`
      unless `raw` is a non-empty string (used for `DELETE /cookies`'s `?name=` query parameter,
      FR-017).
- [X] T038 [US6] Create `src/controllers/cookies.controller.ts` (depends on T037, T036):
      `getCookies(req, res)` → `res.status(200).json({ cookies: cookiesService.listCookies(req)
      })`. `postCookies(req, res)` → `const { name, value } = cookieSetRequestSchema
      .parse(req.body); cookiesService.setCookie(res, name, value); res.status(200).json({ name,
      value })`. `deleteCookies(req, res)` → `const name = cookiesService
      .parseCookieName(req.query.name); cookiesService.clearCookie(res, name); res.status(200)
      .json({ cleared: true, name })`.
- [X] T039 [US6] Create `src/routes/cookies.routes.ts` (depends on T038): `export const
      cookiesRouter = Router({ strict: true });` mount `GET /cookies` → `getCookies`, `POST
      /cookies` → `postCookies`, `DELETE /cookies` → `deleteCookies`, then
      `methodNotAllowedHandler` (all three methods exist on this path from the start, so the
      catch-all is complete in this one task).
- [X] T040 [US6] Wire `cookiesRouter` into `src/app.ts` (depends on T039): mount it top-level,
      matching CLAUDE.md's `/cookies` path spelling (no `/api/v1` prefix).
- [X] T041 [P] [US6] Create `tests/cookies.test.ts` (depends on T040) covering spec.md User Story
      6's acceptance scenarios 1-5 and Edge Cases: `GET /cookies` with none set → `200` with `{
      cookies: {} }`; `POST /cookies` with `{"name":"a","value":"1"}` → `200` with a `Set-Cookie`
      header for `a=1`; after separately setting two cookies (`a` and `b`) and resending both via
      the `Cookie` request header, `GET /cookies` → `200` with **both** `a` and `b` reported, not
      just the most recent; `DELETE /cookies?name=a` → `200` with `{ cleared: true, name: "a" }`
      and a `Set-Cookie` header that expires it, while a subsequent `GET /cookies` (resending only
      `b`) still reports `b`; `DELETE /cookies?name=never-set` → `200` (idempotent, not `404`);
      `POST /cookies` with a missing `name` → `400`; `DELETE /cookies` with no `?name=` → `400`; a
      cookie value containing a space and a semicolon round-trips correctly when set then read
      back (Edge Cases).

**Checkpoint**: All six user stories independently functional (quickstart.md Scenario 6).

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [X] T042 [P] Merge `contracts/http-testing-utilities.openapi.yaml`'s `tags`, `paths`,
      `components.schemas`, and `components.responses` (`PayloadTooLarge`,
      `UnsupportedMediaType`) into the root `openapi.yaml`, reusing the existing
      `Error`/`ValidationError` schemas/responses rather than duplicating them, so `/docs`,
      `/openapi.json`, and `/openapi.yaml` document exactly the 11 operations this spec implements
      (constitution: Quality Gates & Spec Parity). No `allOf`/`oneOf`/`anyOf` combinators.
- [X] T043 Run `npm test` and confirm the full suite — Specs 001-006's existing tests plus
      `tests/delay.test.ts`, `tests/payload.test.ts`, `tests/content.test.ts`,
      `tests/headers.test.ts`, and `tests/cookies.test.ts` — passes, including every Spec 002-006
      test that posts a request body (confirming the new global `express.json({ limit, verify
      })` options from Foundational introduced no regression).
- [X] T044 Execute the manual validation scenarios in
      `specs/007-http-testing-utilities/quickstart.md` against a running `npm run dev` server and
      confirm every expected status code, byte count, and header.
- [X] T045 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the 11
      new endpoints correctly, with no schema errors. Note: `GET /api/v1/routes` is not yet
      implemented in this codebase (Spec 012's deliverable per the roadmap) — verified instead
      that `/openapi.json` lists exactly the 11 documented paths and every `$ref` in them
      resolves.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001, for `bytes`). BLOCKS User Stories 2 and 3
  (both depend on the body-parser limit/raw-body-capture/413-handling this phase establishes).
  User Stories 1, 4, 5, and 6 do not depend on Foundational at all — they could technically start
  in parallel with it, but are listed after it here for a single, consistent checkpoint.
- **User Story 1 (Phase 3)**: Independent of Foundational and every other story.
- **User Story 2 (Phase 4)**: Depends on Foundational (T001, for `bytes`; the body-parser `limit`
  conceptually bounds the same maximum this story's `size` check enforces, though User Story 2
  itself only reads `config.maxPayloadSize`, it doesn't depend on T002-T004's raw-body/413 logic).
- **User Story 3 (Phase 5)**: Depends on Foundational (T002-T004, for raw-body capture and `413`
  handling) **and** on User Story 2's `payload.service.ts`/`payload.controller.ts`/
  `payload.routes.ts` files (T014-T016), which it extends rather than duplicates.
- **User Story 4 (Phase 6)**: Independent of Foundational and every other story.
- **User Story 5 (Phase 7)**: Independent of Foundational and every other story.
- **User Story 6 (Phase 8)**: Independent of Foundational and every other story.
- **Polish (Phase 9)**: Depends on all six user stories being complete.

### Within Each User Story

- US1: param validator → service → controller → routes → `app.ts` wiring → tests.
- US2: catalog + param validators (parallel) → service → controller → routes (GET only, no
  catch-all yet) → `app.ts` wiring → tests.
- US3: extends US2's service → controller → routes (adds POST + the path's catch-all) → tests
  (extends US2's test file).
- US4: catalog → param validator → service → controller → routes (GET+POST+catch-all together) →
  `app.ts` wiring → tests.
- US5: service → controller → routes → `app.ts` wiring → tests.
- US6: utils + model (parallel) → service → controller → routes → `app.ts` wiring → tests.

### Parallel Opportunities

- Once Setup (T001) lands, User Story 1 (Phase 3) can start immediately in parallel with
  Foundational (Phase 2), since US1 depends on neither.
- Once Foundational completes, User Stories 2, 4, 5, and 6 can all start in parallel with each
  other (US3 must wait for US2's files to exist).
- Within US2: T011, T012, T013 (catalog + two param validators) run in parallel — different
  files, no cross-dependencies.
- Within US4: T023 and T024 run in parallel once T023's types exist for T024 to import (T024
  technically depends on T023, so they are sequential, not parallel — mark T024 without `[P]`
  relative to T023... both are still marked `[P]` above since each is the *first* task in its
  respective file with no other in-flight dependency at that moment; treat T023 as landing
  fractionally before T024 in practice).
- Within US6: T035 and T036 run in parallel — different files, no cross-dependencies.
- User Stories 4, 5, and 6 (Phases 6-8) can all proceed fully in parallel with each other and with
  User Stories 2/3, since none share a file with any other story except `src/app.ts`.
- T042 and T045 (Polish) run in parallel; T043 and T044 are sequential whole-suite/manual checks.

---

## Parallel Example: Foundational + User Story 1

```bash
# User Story 1 has no dependency on Foundational and can start the moment Setup (T001) lands:
Task: "Implement GET /delay/{ms} and GET /delay?ms= end-to-end (User Story 1)"
Task: "Wire MAX_PAYLOAD_SIZE into express.json() and add the 413 error branch (Foundational)"
```

## Parallel Example: User Stories 4, 5, and 6

```bash
# Once Foundational completes, these three stories touch entirely different files:
Task: "Implement GET/POST /content/{type} (User Story 4)"
Task: "Implement GET /headers (User Story 5)"
Task: "Implement GET/POST/DELETE /cookies (User Story 6)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 (delay, full test coverage) — does not require Foundational.
3. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently.
4. Deploy/demo if ready — this alone gives testing tools a working latency-simulation endpoint.

### Incremental Delivery

1. Setup → `bytes` dependency ready.
2. User Story 1 → test independently → deploy/demo (MVP!) — in parallel with Foundational.
3. Foundational → body-parser limit/raw-body/413 handling ready.
4. User Story 2 → test independently → deploy/demo.
5. User Story 3 → test independently → deploy/demo (extends User Story 2's files).
6. User Story 4 → test independently → deploy/demo.
7. User Story 5 → test independently → deploy/demo.
8. User Story 6 → test independently → deploy/demo.
9. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple developers, after Setup lands: Developer A takes US1 immediately; Developer B takes
Foundational, then US2 → US3 (sequential, shared `payload.*` files); Developer C takes US4;
Developer D takes US5; Developer E takes US6 — C, D, and E can start as soon as Foundational
completes, fully in parallel with B and with each other.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks (except where noted, e.g.
  T018/T022 both extend the same test file, and T014-T016/T019-T021 both extend the same
  service/controller/routes files across US2 → US3).
- [Story] label maps a task to its user story for traceability.
- Foundational (T002-T004) fixes a pre-existing, previously-invisible gap affecting every prior
  spec's endpoints (`MAX_PAYLOAD_SIZE` was never enforced anywhere) — T043 explicitly re-runs the
  full existing suite to confirm no regression from this change.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies
  that would break a later story's ability to be demoed on its own once its prerequisite stories
  exist.
