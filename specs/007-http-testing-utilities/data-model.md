# Phase 1 Data Model: HTTP Testing Utilities

Every entity below is either a fixed, static catalog (no lifecycle) or purely request-scoped
(exists only for the duration of one HTTP request/response, never persisted). This spec introduces
no mutable server-side store — the simplest data footprint of any spec so far.

## PayloadSizePreset (fixed catalog)

```ts
export const PAYLOAD_SIZE_PRESETS = ["small", "medium", "large"] as const;
export type PayloadSizePreset = (typeof PAYLOAD_SIZE_PRESETS)[number];

export const PAYLOAD_SIZE_PRESET_BYTES: Record<PayloadSizePreset, number> = {
  small: 1_024,        // 1 KB
  medium: 102_400,      // 100 KB
  large: 1_048_576,     // 1 MB
};
```

Confirmed exact via the Clarifications session. Defined in `src/data/payloadPresets.catalog.ts`.
No lifecycle — a plain lookup table.

## GeneratedPayload (computed, not stored)

| Field | Type | Notes |
|---|---|---|
| `size` | `number` | The target byte count this payload was generated for |
| `data` | `string` | A filler string of `"a"` characters, sized so the full `JSON.stringify(...)` output is exactly `size` bytes when `size >= shellBytes` (research.md Decision 5) |

Produced by `generatePayload(targetBytes)` in `src/services/payload.service.ts`. Never persisted.

## PayloadEchoResult (computed, not stored)

```ts
interface PayloadEchoResult {
  received: true;
  contentLength: number;
}
```

`contentLength` is `req.rawBody?.length ?? 0` (research.md Decision 2) — the exact byte length of
the request body as transmitted, captured via `express.json()`'s `verify` hook, never
re-serialized from the parsed body.

## ContentTypeDemo (fixed catalog)

```ts
export const CONTENT_TYPES = ["json", "text", "html", "xml"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

interface ContentTypeDemo {
  mediaType: string;       // e.g. "application/json"
  buildBody: () => string | object;
}
```

| `type` | `mediaType` | Body |
|---|---|---|
| `json` | `application/json` | A fixed, deterministic JSON object |
| `text` | `text/plain` | A fixed plain-text string |
| `html` | `text/html` | A fixed, well-formed HTML document string |
| `xml` | `application/xml` | A fixed, well-formed XML document string |

Defined in `src/data/contentTypeDemos.catalog.ts`. No lifecycle — a plain lookup table keyed by
`ContentType`.

## SafeHeaders (computed, not stored)

```ts
const SENSITIVE_HEADER_NAMES = ["authorization", "cookie", "x-api-key"] as const;
```

`getSafeHeaders(req)` (`src/services/headers.service.ts`) returns every entry of `req.headers`
(Node.js already lowercases incoming header names) whose key is **not** in
`SENSITIVE_HEADER_NAMES`, as a plain `Record<string, string | string[]>`. Computed fresh per
request; nothing stored.

## Cookie (client-held, not stored server-side)

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Non-empty; the cookie's name |
| `value` | `string` | May be empty; the cookie's value |

An arbitrary number of independently-named cookies may coexist (confirmed in Clarifications).
`GET /cookies` parses `req.headers.cookie` via `parseCookieHeader` (research.md Decision 6) into
`Record<string, string>` and returns it as-is — this feature keeps no registry of its own; the
client's own resent `Cookie` header is the only source of truth.

## Validation rules (from Functional Requirements)

- `GET /delay/{ms}` / `GET /delay?ms=`: `ms` — non-negative integer, `<= config.maxDelayMs` → else
  `400` (FR-002/FR-003).
- `GET /payload/{preset}`: `preset` — one of `PAYLOAD_SIZE_PRESETS` → else `400` (FR-006).
- `GET /payload?size=`: `size` — non-negative integer, `<= bytes(config.maxPayloadSize)` → else
  `400` (FR-005/FR-006).
- `POST /payload` body: any well-formed JSON value (object, array, primitive, empty) — invalid
  JSON → `400` (existing global `ZodError`/`isJsonParseError` handling, FR-008); body exceeding
  `config.maxPayloadSize` → `413` (research.md Decision 3, FR-009).
- `GET /content/{type}` / `POST /content/{type}`: `type` — one of `CONTENT_TYPES` → else `400`
  (FR-011). `POST`'s `Content-Type` header must match that type's `mediaType` → else `415`
  (FR-012).
- `POST /cookies` body: `cookieSetRequestSchema` — `name: z.string().min(1)`,
  `value: z.string()`, `.strict()` → missing/wrong-typed `name` → `400` (FR-017).
- `DELETE /cookies`: `?name=` query parameter, non-empty → else `400` (FR-017).
