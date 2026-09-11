# Phase 1 Data Model: Status Code Playground

**Feature**: `004-status-code-playground` | **Date**: 2026-09-12

This feature introduces no persisted entity and no in-memory store — every response is computed from a
static, hand-authored catalog (research.md). The shapes below are response contracts, not stored records.

## StatusCodeDemo (static reference data, not a stored entity)

One entry per documented code, held in `src/data/statusCodeDemos.catalog.ts`.

| Field | Type | Notes |
|---|---|---|
| `code` | integer, one of the 24 documented values | The demonstrated HTTP status |
| `name` | string | Standard HTTP reason phrase (e.g. `"OK"`, `"Not Found"`) |
| `message` | string | Plain-language description of the demonstrated condition, used in the success/redirect body or the error envelope's `error.message` |
| `shape` | enum: `"success"` \| `"noBody"` \| `"redirect"` \| `"error"` | Determines how the controller builds the response (research.md) |
| `errorCode` | string, present only when `shape === "error"` | The `error.code` value for the standard error envelope (research.md's code-naming decision) |
| `extraHeaders` | `Record<string, string>`, optional | Static headers beyond `X-Request-ID`/`Content-Type` — `Allow` for 405, `Retry-After` for 429 |

**Seed volume**: exactly 24 entries — one per code in FR-001's documented list. No more, no fewer; this is
the full set of codes this endpoint responds to as a "known" code.

**Validation rules**: none (this is fixed reference data, never accepted from a request). The `code` path
parameter is validated separately by `src/utils/statusCodeParam.ts` before this catalog is consulted.

## Response shapes by `shape` value

| `shape` | Applies to | Status set on response | Body | Extra headers |
|---|---|---|---|---|
| `success` | 200, 201, 202 | the demonstrated code | `{ status, name, message }` | none |
| `noBody` | 204, 304 | the demonstrated code | none (`res.end()`) | none |
| `redirect` | 301, 302 | the demonstrated code | `{ status, name, message, location }` | `Location: {apiPrefix}/status/200`, computed at request time from `config.apiPrefix` |
| `error` | 400, 401, 403, 404, 405, 406, 408, 409, 410, 415, 422, 429, 500, 501, 502, 503, 504 | the demonstrated code | standard `ErrorEnvelope` (`error.code` = catalog's `errorCode`, `error.message` = catalog's `message`) | `Allow: GET` (405 only), `Retry-After: 60` (429 only) |

## Path parameter: `code`

| Rule | Outcome |
|---|---|
| Not a strict positive integer (non-numeric, negative, zero, decimal, empty, leading zero, or surrounding whitespace) | `400 VALIDATION_ERROR` (FR-010) — resolves the Clarifications session's leading-zero/whitespace question: rejected, never normalized |
| A strict positive integer outside `100–599` | `400 VALIDATION_ERROR` (FR-011, the "huge"/out-of-range case) — resolves the Clarifications session's boundary question |
| A strict positive integer within `100–599` but not one of the 24 catalog entries (e.g. `418`) | `400 UNSUPPORTED_STATUS_CODE` (FR-012) |
| One of the 24 catalog entries | Proceeds to the matching `StatusCodeDemo` entry above |

## Shared envelopes (reused, not redefined)

- **All error-shaped responses** use `ErrorEnvelope` exactly as defined in Spec 001
  (`src/models/errorEnvelope.ts`). Four error codes are reused unchanged from earlier specs
  (`VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `METHOD_NOT_ALLOWED`, `INTERNAL_ERROR`); the remaining
  error-shaped codes are new, minted once each in this spec (research.md).
- **No pagination envelope is used** — every response is a single object (or no body), never a list.
