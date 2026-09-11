# Phase 0 Research: Status Code Playground

**Feature**: `004-status-code-playground` | **Date**: 2026-09-12

Spec 001 fixed the stack and shared conventions (Express + TypeScript on Node 20, `ErrorEnvelope`,
`HttpError` + central error middleware, `X-Request-ID`, Vitest + Supertest). Spec 002/003 established the
`parse-or-throw` path-parameter-validator pattern (`src/utils/idParam.ts`, `ratingParam.ts`, etc.) this
feature reuses. This spec's genuine new decisions — a single endpoint demonstrating 24 distinct status
codes with no backing resource — are recorded below. Both open questions from the Clarifications session
are resolved here as concrete implementation choices.

## Decision: One static, hand-authored catalog of per-code demo definitions

- **Rationale**: The 24 documented codes need distinct response shapes (2xx body, no-body, redirect,
  standard error envelope) and per-code metadata (name, message, error code, extra headers). Modeling
  this as a small static array — `src/data/statusCodeDemos.catalog.ts` — mirrors how the project already
  keeps other fixed reference sets (`src/models/enums.ts`) as plain data, and keeps the controller free of
  a 24-branch conditional. Each entry is `{ code, name, message, shape, errorCode?, extraHeaders? }` where
  `shape` is one of `"success" | "noBody" | "redirect" | "error"`.
- **Alternatives considered**: A `switch` statement in the controller with 24 cases — works, but scatters
  the per-code metadata needed by both the controller (response shape) and the OpenAPI contract
  (descriptions/examples) instead of keeping it in one reviewable table.

## Decision: Reuse existing error codes where semantics already match; mint one new code per remaining status

- **Rationale**: `VALIDATION_ERROR` (400), `RESOURCE_NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), and
  `INTERNAL_ERROR` (500) already exist in the codebase (`errorHandler.ts`, `idParam.ts`, etc.) with exactly
  the semantics this feature demonstrates for those codes — reusing them keeps one canonical name per
  condition project-wide instead of introducing a near-duplicate. The remaining error-shaped codes each get
  one new, descriptive `SCREAMING_SNAKE_CASE` name: `UNAUTHORIZED` (401), `FORBIDDEN` (403),
  `NOT_ACCEPTABLE` (406), `REQUEST_TIMEOUT` (408), `CONFLICT` (409), `GONE` (410),
  `UNSUPPORTED_MEDIA_TYPE` (415), `UNPROCESSABLE_ENTITY` (422), `RATE_LIMIT_EXCEEDED` (429),
  `NOT_IMPLEMENTED` (501), `BAD_GATEWAY` (502), `SERVICE_UNAVAILABLE` (503), `GATEWAY_TIMEOUT` (504). A
  distinct `UNSUPPORTED_STATUS_CODE` covers FR-012 (a well-formed but undocumented `code` value).
- **Alternatives considered**: One generic `STATUS_DEMO` code for every 4xx/5xx case, with the real status
  number as the only differentiator — rejected because it discards the per-condition testability
  (`error.code` assertions) every other spec's error responses already provide.

## Decision: Strict single-regex validator resolves both Clarifications-session questions at once

- **Rationale**: `src/utils/statusCodeParam.ts` follows the existing `idParam.ts`/`ratingParam.ts`
  parse-or-throw shape, but with a stricter pattern than `idParam.ts` uses: `^[1-9]\d*$` (no sign, no
  decimal point, no leading zero, no surrounding whitespace — `\d+$` alone would accept `"0200"`, which the
  Clarifications session decided must be rejected, not normalized). Any string failing that pattern
  — non-numeric, negative, zero, decimal, empty, leading-zero, or whitespace-padded — is FR-010's malformed
  case. A value that parses but falls outside `100–599` (the session's agreed boundary) is FR-011's
  huge/out-of-range case. A value inside `100–599` but absent from the 24-entry catalog is FR-012's
  unsupported case. All three return `400` via the same `HttpError` pattern the rest of the project uses,
  differing only in `code`/`message`.
- **Alternatives considered**: Reusing `idParam.ts` unchanged — rejected because its `\d+$` pattern
  followed by `Number(raw)` normalizes `"0200"` to `200`, which is exactly the silent-normalization behavior
  the Clarifications session rejected.

## Decision: Redirects (301/302) set `Location` manually instead of using `res.redirect()`

- **Rationale**: Express's `res.redirect()` sends an HTML body by default, but FR-004 requires a small JSON
  body describing the redirect for clients that don't auto-follow it. The controller instead sets
  `Location` directly (`res.status(code).set("Location", target)`) and follows with
  `res.json({ status, name, message, location: target })`. The target is computed at request time as
  `` `${config.apiPrefix}/status/200` `` (not hardcoded), so it stays correct if `API_PREFIX` is
  reconfigured, and it always resolves to this same endpoint's own 200 demonstration — a harmless,
  documented target per the spec's Assumptions.
- **Alternatives considered**: `res.redirect()` with a trailing `.json()` — doesn't work; Express's
  `redirect()` ends the response itself, so a body set beforehand is not guaranteed to be honored by every
  client, and the default HTML fallback body would ship instead of the documented JSON shape.

## Decision: Fixed, non-negotiated values for 304 and 429

- **Rationale**: Per the spec's Assumptions, this feature demonstrates 304 unconditionally (no
  `ETag`/`If-None-Match` negotiation — that arrives with Spec 008's `/cache/resource`) and 429 with a fixed
  `Retry-After` header value (no real rate-limit counter — that arrives with Spec 008's `/rate-limit`).
  Both are represented as static `extraHeaders` (429 → `Retry-After: "60"`) or a `shape: "noBody"` entry
  (304) in the catalog, keeping this endpoint fully deterministic and stateless.
- **Alternatives considered**: Wiring a real conditional-request check or a real request counter here —
  rejected as scope creep; both mechanisms are explicitly assigned to Spec 008 by the roadmap, and
  duplicating them here would create two divergent implementations to keep in sync later.

## Decision: 405's `Allow` header advertises this endpoint's own real allowed method

- **Rationale**: FR-007 requires an `Allow` header on the 405 demonstration. Because `GET
  /api/v1/status/{code}` is itself a GET-only route (see `methodNotAllowedHandler`, the existing
  project-wide 405 fallback for any route hit with a wrong method), advertising `Allow: GET` on the
  dedicated demo is both a plausible example value and literally true of the endpoint answering the
  request — no fictitious method list is needed.
- **Alternatives considered**: A fabricated multi-method `Allow` list (e.g. `GET, POST, DELETE`) to look
  more "realistic" — rejected as unnecessary invention when the literally-true value already satisfies
  FR-007.

## Runtime target

- **Decision**: No change from Specs 001–003 — TypeScript on Node.js 20.x, Express 4.x, Vitest + Supertest.
  This spec introduces no new runtime dependency and no new environment variable.

All unknowns from the Technical Context are resolved above; none remain marked `NEEDS CLARIFICATION`.
