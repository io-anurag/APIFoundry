---

description: "Task list template for feature implementation"
---

# Tasks: Status Code Playground

**Input**: Design documents from `/specs/004-status-code-playground/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/status-code-playground.openapi.yaml](contracts/status-code-playground.openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: Included. `CLAUDE.md`'s Testing Expectations and the constitution's Quality Gates
("new or changed endpoints MUST include corresponding automated test coverage ... before being
considered done") make test coverage mandatory for this project, not optional.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation
and testing of each story. This feature is a single endpoint, so per research.md's "one regex plus one
range check" decision, the complete `code` path-parameter validator (covering FR-010/FR-011/FR-012
together) is built once in Foundational; User Stories 2 and 3 then each own the dedicated test coverage
that verifies their specific slice of that already-built, shared validation behavior — mirroring how
Spec 003 built its path-parameter validators in Foundational and exercised their edge cases story by
story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (per plan.md): `src/`, `tests/` at repository root, extending the existing Spec
001-003 layout. No new top-level directories, and no changes to any Spec 002/003 resource file (this
feature has no dependency on either).

## Phase 1: Setup

**Purpose**: Project initialization and basic structure.

No setup tasks are needed: this feature adds no new dependency, environment variable, or shared
constant beyond what Phase 2 (Foundational) creates from scratch (Technical Context, research.md).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared model, catalog, service, and path-parameter validator every user story's
behavior depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Create `src/models/statusCodeDemo.ts`: a `ResponseShape` union type
      (`"success" | "noBody" | "redirect" | "error"`), a `StatusCodeDemo` interface — `code` (integer),
      `name` (string, the standard HTTP reason phrase), `message` (string), `shape` (`ResponseShape`),
      `errorCode` (string, optional — present only when `shape === "error"`), `extraHeaders`
      (`Record<string, string>`, optional) — and an exported `DOCUMENTED_STATUS_CODES` readonly array of
      exactly the 24 codes from FR-001: `[200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405,
      406, 408, 409, 410, 415, 422, 429, 500, 501, 502, 503, 504]` (data-model.md).
- [X] T002 Create `src/data/statusCodeDemos.catalog.ts` (depends on T001 for the `StatusCodeDemo` type):
      a `STATUS_CODE_DEMOS: StatusCodeDemo[]` with exactly 24 entries, one per `DOCUMENTED_STATUS_CODES`
      value, per data-model.md's shape table and research.md's error-code-naming decision:
      - `shape: "success"` for 200 (name "OK"), 201 ("Created"), 202 ("Accepted") — each with a
        `message` describing the demonstrated code.
      - `shape: "noBody"` for 204 ("No Content"), 304 ("Not Modified") — no `message` is rendered for
        these (data-model.md: `res.end()`, no body).
      - `shape: "redirect"` for 301 ("Moved Permanently"), 302 ("Found") — each with a `message`; the
        `Location` header value is computed at request time in the controller (T005), not stored here.
      - `shape: "error"` for the remaining 17 codes, each with the exact `errorCode` from research.md:
        400 → `VALIDATION_ERROR`, 401 → `UNAUTHORIZED`, 403 → `FORBIDDEN`, 404 → `RESOURCE_NOT_FOUND`,
        405 → `METHOD_NOT_ALLOWED` (`extraHeaders: { Allow: "GET" }`), 406 → `NOT_ACCEPTABLE`,
        408 → `REQUEST_TIMEOUT`, 409 → `CONFLICT`, 410 → `GONE`, 415 → `UNSUPPORTED_MEDIA_TYPE`,
        422 → `UNPROCESSABLE_ENTITY`, 429 → `RATE_LIMIT_EXCEEDED`
        (`extraHeaders: { "Retry-After": "60" }`), 500 → `INTERNAL_ERROR`, 501 → `NOT_IMPLEMENTED`,
        502 → `BAD_GATEWAY`, 503 → `SERVICE_UNAVAILABLE`, 504 → `GATEWAY_TIMEOUT`.
- [X] T003 [P] Implement `src/utils/statusCodeParam.ts` (depends on T001 for `DOCUMENTED_STATUS_CODES`):
      `parseStatusCodeParam(raw: string): number`, a parse-or-throw function following the existing
      `idParam.ts`/`ratingParam.ts` pattern, implementing all three validation rules from data-model.md
      in order: (1) reject with `HttpError(400, "VALIDATION_ERROR", ...)` if `raw` does not match
      `^[1-9]\d*$` — this single regex rejects non-numeric, negative, zero, decimal, empty, leading-zero,
      and whitespace-padded values in one shot, resolving the Clarifications session's leading-zero/
      whitespace question (FR-010); (2) reject with `HttpError(400, "VALIDATION_ERROR", ...)` if the
      parsed integer is outside `100-599` inclusive — resolving the Clarifications session's
      huge-vs-unsupported boundary question (FR-011); (3) reject with
      `HttpError(400, "UNSUPPORTED_STATUS_CODE", ...)` if the parsed integer is not a member of
      `DOCUMENTED_STATUS_CODES` (FR-012); otherwise return the parsed integer.
- [X] T004 Implement `src/services/statusCode.service.ts` (depends on T001, T002):
      `getStatusCodeDemo(code: number): StatusCodeDemo` — a lookup into `STATUS_CODE_DEMOS` by `code`.
      Since `code` has already passed `parseStatusCodeParam` (T003) by the time this is called, every
      lookup here is guaranteed to hit; no not-found handling is needed in this function.

**Checkpoint**: Foundation ready — the catalog, model, service, and full `code` validator all exist and
are independently unit-testable; user story implementation can now begin.

---

## Phase 3: User Story 1 - Exercise Every Documented Status Code (Priority: P1) 🎯 MVP

**Goal**: `GET /api/v1/status/{code}` exists and returns the exact status, headers, and body shape for
each of the 24 documented codes.

**Independent Test**: Request each of the 24 documented codes and confirm the response's status line,
headers (`Location` for redirects, `Allow` for 405, `Retry-After` for 429), and body shape match that
code's documented semantics; confirm repeated requests for the same code are byte-identical aside from
`X-Request-ID`.

- [X] T005 [US1] Implement `src/controllers/statusCode.controller.ts` (depends on T003, T004):
      `demonstrateStatusCode(req, res)` — parses `req.params.code` via `parseStatusCodeParam` (T003),
      looks up the matching `StatusCodeDemo` via `getStatusCodeDemo` (T004), then dispatches on
      `demo.shape`: `"success"` → `res.status(demo.code).json({ status: demo.code, name: demo.name,
      message: demo.message })`; `"noBody"` → `res.status(demo.code).end()`; `"redirect"` → compute
      `target = \`${config.apiPrefix}/status/200\`` at request time, then
      `res.status(demo.code).set("Location", target).json({ status: demo.code, name: demo.name,
      message: demo.message, location: target })`; `"error"` → apply `demo.extraHeaders` (if any) via
      `res.set(...)`, then `res.status(demo.code).json(buildErrorEnvelope(demo.errorCode!, demo.message,
      requestIdOf(req)))` (FR-002 through FR-009).
- [X] T006 [US1] Implement `src/routes/statusCode.routes.ts` (depends on T005): mount
      `GET /api/v1/status/:code` → `statusCodeController.demonstrateStatusCode`, with
      `.all("/status/:code", methodNotAllowedHandler)` registered after it, matching the existing
      per-resource router convention (e.g. `category.routes.ts`).
- [X] T007 [US1] Mount `statusCodeRouter` on the existing `apiRouter` in `src/app.ts`, alongside the
      Spec 002/003 routers (depends on T006).
- [X] T008 [P] [US1] Write `tests/statusCodes.test.ts` (depends on T007): for each of the 24 documented
      codes, `GET /api/v1/status/{code}` returns that exact status; 200/201/202 return a JSON body with
      `status`/`name`/`message`; 204/304 return no response body; 301/302 return a `Location` header
      (pointing at `/api/v1/status/200`) and a JSON body including `location`; every error-shaped code's
      `error.code` matches the value fixed in T002 (400 → `VALIDATION_ERROR`, ..., 504 →
      `GATEWAY_TIMEOUT`); 405's response includes `Allow: GET`; 429's response includes a `Retry-After`
      header; every response (success or error) includes `X-Request-ID`; two consecutive requests for
      the same code return identical bodies once `requestId`/`error.requestId` is excluded from the
      comparison (SC-001, SC-003, FR-013, FR-014).

**Checkpoint**: User Story 1 complete — every documented status code is independently demonstrable and
testable. This is the MVP.

---

## Phase 4: User Story 2 - Reject Malformed Code Values Safely (Priority: P2)

**Goal**: Every malformed `code` value (non-numeric, negative, zero, decimal, empty, leading-zero,
whitespace-padded, or out of the 100-599 range) is rejected with a structured `400`, never a crash or an
accidental pass-through status.

**Independent Test**: Send the full malformed-`code` matrix against the already-running endpoint from
User Story 1 and confirm every value returns `400` with `error.code: "VALIDATION_ERROR"`.

> **Note**: `parseStatusCodeParam` (T003) already implements this rejection in full — it was built once,
> in Foundational, to satisfy FR-010 and FR-011 together (research.md). This story's task is the
> dedicated test coverage that verifies that guarantee end-to-end through the real HTTP endpoint, not a
> new implementation.

- [X] T009 [P] [US2] Add malformed-`code` edge-case tests to `tests/statusCodes.test.ts` (depends on
      T008): `GET /api/v1/status/{code}` for `code` = `abc` (non-numeric), `-1` (negative), `0` (zero),
      `200.5` (decimal), an empty path segment, `0200` (leading zero — confirm it is rejected, not
      silently treated as `200`), a URL-encoded whitespace-padded value (e.g. `%20200%20`), `99` and
      `600` (just outside the 100-599 boundary), and `9999999999` (far outside the range) — each MUST
      return `400` with `error.code: "VALIDATION_ERROR"`, never a `404`, a `500`, or the value's own
      would-be status (FR-010, FR-011).

**Checkpoint**: User Stories 1 and 2 both work — the endpoint's malformed-input handling is fully
verified alongside its happy path.

---

## Phase 5: User Story 3 - Reject Well-Formed but Unsupported Codes (Priority: P3)

**Goal**: A syntactically valid integer in the 100-599 range that is not one of the 24 documented codes
(e.g. `418`) is rejected with a dedicated, structured `400` rather than being passed through or returning
`404`.

**Independent Test**: Request a handful of valid-looking but undocumented status codes and confirm each
is rejected the same explicit way.

> **Note**: `parseStatusCodeParam` (T003) already implements this rejection (FR-012). This story's task
> is the dedicated test coverage that verifies it end-to-end.

- [X] T010 [P] [US3] Add well-formed-but-unsupported tests to `tests/statusCodes.test.ts` (depends on
      T008): `GET /api/v1/status/418` and `GET /api/v1/status/494` each return `400` with
      `error.code: "UNSUPPORTED_STATUS_CODE"` — distinct from the `VALIDATION_ERROR` code used for
      genuinely malformed values (T009), and never `404` or a pass-through response (FR-012).

**Checkpoint**: All three user stories are independently functional and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Spec-parity and whole-suite verification.

- [X] T011 [P] Merge `contracts/status-code-playground.openapi.yaml`'s `tags`, `paths`, and
      `components.schemas`/`components.parameters` into the root `openapi.yaml`, so `/docs`,
      `/openapi.json`, and `/openapi.yaml` document exactly the one operation and 24+1 response entries
      this spec implements (constitution: Quality Gates & Spec Parity).
- [X] T012 Run `npm test` and confirm the full suite — Specs 001-003's existing tests plus
      `tests/statusCodes.test.ts` — passes.
- [X] T013 Execute the manual validation scenarios in
      `specs/004-status-code-playground/quickstart.md` against a running `npm run dev` server and
      confirm every expected status code and behavior.
- [X] T014 [P] Spot-check `/docs` (Swagger UI), `/openapi.json`, and `/openapi.yaml` render the new
      `/api/v1/status/{code}` operation correctly, with no schema errors.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks — nothing to configure for this feature.
- **Foundational (Phase 2)**: BLOCKS all user stories. T001 blocks T002, T003, and T004; T002 and T003
  can proceed in parallel once T001 exists; T004 depends on both T001 and T002.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Delivers the working endpoint every
  later story's tests exercise.
- **User Story 2 (Phase 4)**: Depends on **User Story 1**'s test file existing (T008) to extend, and on
  the Foundational validator (T003) whose behavior it verifies. Independent of User Story 3.
- **User Story 3 (Phase 5)**: Depends on **User Story 1**'s test file existing (T008), and on the
  Foundational validator (T003). Independent of User Story 2 — may proceed in parallel with it.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- US1: controller → routes → `app.ts` wiring → tests, in that order (each depends on the previous file
  existing).
- US2 and US3: each is a single, self-contained test-addition task with no dependency on the other.

### Parallel Opportunities

- T001 must land first, but T002 and T003 then run in parallel (different files, both depend only on
  T001).
- T009 (US2) and T010 (US3) both extend `tests/statusCodes.test.ts` after T008 exists; since they touch
  the same file, treat them as sequential in execution even though they are independent in content — the
  second to land should append rather than conflict with the first's edits.
- T011 and T014 (Polish) run in parallel; T012 and T013 are sequential whole-suite/manual checks.

---

## Parallel Example: Foundational

```bash
# After T001 (model) lands, launch the catalog and validator together:
Task: "Create src/data/statusCodeDemos.catalog.ts"
Task: "Implement src/utils/statusCodeParam.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
2. Complete Phase 3: User Story 1 (the working endpoint, all 24 codes, full test coverage).
3. **STOP and VALIDATE**: run the User Story 1 section of `quickstart.md` independently.
4. This is a usable MVP: automated testing tools already have a complete status-code demonstration
   target, and the shared Foundational validator already guarantees safe handling of bad input even
   before US2/US3's dedicated tests land.

### Incremental Delivery

1. Foundational → shared model/catalog/service/validator ready.
2. User Story 1 → validate independently → MVP.
3. User Story 2 → validate independently → malformed-input guarantee formally verified.
4. User Story 3 → validate independently → well-formed-but-unsupported guarantee formally verified.
5. Polish → spec/implementation parity confirmed, full suite green.

### Parallel Team Strategy

With multiple contributors: one completes Foundational alone (T001 → T002/T003 in parallel → T004);
once merged, one contributor builds User Story 1 end-to-end (T005-T008 are sequential within this
single-endpoint feature); once US1's test file exists, two contributors can each add US2's and US3's
test cases in parallel, coordinating on the shared `tests/statusCodes.test.ts` file to avoid edit
conflicts.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks (except where noted, e.g. T002/T003
  both need T001's types first).
- [Story] label maps a task to its user story for traceability.
- The Foundational validator (T003) is the single mechanism satisfying FR-010, FR-011, and FR-012
  together; US2 and US3's test tasks verify it, they do not re-implement it.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
- Avoid: vague tasks, same-file conflicts between tasks marked `[P]`, and cross-story dependencies that
  would break a later story's ability to be demoed on its own once User Story 1 exists.
