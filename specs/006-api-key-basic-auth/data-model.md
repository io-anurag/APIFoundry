# Phase 1 Data Model: API Key & Basic Auth

Entities derived from spec.md's Key Entities section and research.md's storage/generation
decisions. Neither entity here is a CRUD resource: `ApiKey` is a mutable in-memory store with a
narrow issue/revoke lifecycle (no update/list/delete-by-id-other-than-revoke), and
`BasicAuthDemoAccount` is static, single-record seed data.

## ApiKeyKind / ApiKeyStatus (new)

```ts
export const API_KEY_KINDS = ["valid", "expired", "revoked"] as const;
export type ApiKeyKind = (typeof API_KEY_KINDS)[number];

export type ApiKeyStatus = "active" | "expired" | "revoked";
```

- `ApiKeyKind` is the `POST /auth/api-key` request parameter (research.md Decision 3).
- `ApiKeyStatus` is the computed, response-facing state (see "Computed status" below) — never
  stored as its own field; derived from `revoked` and `expiresAt` at read time.

## ApiKey (new in-memory store)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Primary key for `KeyedStore` — holds the **raw key value** itself (research.md Decision 1), never exposed under the name `id` in any response body |
| `keyId` | `string` (UUID) | Non-secret, human-facing identifier returned to callers for correlation/labeling; never used for lookup |
| `label` | `string \| null` | Caller-supplied purpose string from `POST /auth/api-key`; `null` when omitted |
| `revoked` | `boolean` | `true` for a `kind: revoked` key at issuance, or any key after `POST /auth/api-key/revoke` |
| `issuedAt` | `string` (ISO 8601) | Set at creation, never changes |
| `expiresAt` | `string` (ISO 8601) `\| null` | `null` for `kind: valid` (never expires, per the Clarifications session); already in the past for `kind: expired` |

Keyed by the raw key value in `src/data/apiKey.store.ts`, reusing `createKeyedStore` exactly as
Spec 005's `session.store.ts` does. Bounded by request volume; `reset()` is called from
`tests/helpers/resetStores.ts` between tests, and will be called by the future admin/reset
feature (Spec 011) in the running server.

### Computed status

```ts
function computeStatus(key: ApiKey): ApiKeyStatus {
  if (key.revoked) return "revoked";
  if (key.expiresAt !== null && Date.parse(key.expiresAt) <= Date.now()) return "expired";
  return "active";
}
```

Because `kind: valid` keys have `expiresAt: null`, this function's real-wall-clock branch only
ever fires for a `kind: expired` key — and since that key's `expiresAt` is already in the past at
issuance, the outcome is identical on every subsequent check, preserving determinism (constitution
Principle II; research.md Decision 3).

## BasicAuthDemoAccount (new, static — not a store)

| Field | Type | Notes |
|---|---|---|
| `username` | `string` | The single fixed demo username |
| `password` | `string` | Plaintext (research.md Decision 4); never included in any response/log |

Exactly one record, exported as a constant from `src/data/basicAuthAccount.seed.ts`. Not a
mutable store — no create/update/delete/reset lifecycle, and therefore no entry needed in
`tests/helpers/resetStores.ts`.

## Relationships

```text
POST /auth/api-key ──creates──> ApiKey (kind determines initial revoked/expiresAt)
ApiKey ──X-API-Key header lookup──> GET /api-key/protected (200 if status == active, else 401)
ApiKey ──X-API-Key header lookup──> POST /auth/api-key/revoke (sets revoked = true; 404 if not found)

BasicAuthDemoAccount ──HTTP Basic credentials──> GET /auth-test/basic (200 if username+password match)
```

No relationship between `ApiKey`/`BasicAuthDemoAccount` and any entity from another spec — both
are entirely self-contained, per this spec's parallelizability with Specs 003/004/005.

## Validation rules (from Functional Requirements)

- `POST /auth/api-key` body: `label` (optional string), `kind` (optional, one of `API_KEY_KINDS`,
  default `"valid"`) — unknown `kind` value or wrong field type → `400` (FR-012). No other fields
  accepted (`additionalProperties: false`, matching every other request schema in this codebase).
- `GET /api-key/protected` / `POST /auth/api-key/revoke`: `X-API-Key` header — missing → `401`
  (protected endpoint) or `401` (revoke, per the Edge Cases section — consistent with the
  protected endpoint rather than a false `404`); present but never issued → `401` (protected) or
  `404` (revoke, FR-002); present, issued, but `status !== "active"` → `401` with the specific
  reason (protected only — revoke succeeds idempotently regardless of status, FR-002).
- `GET /auth-test/basic`: `Authorization` header — missing → `401` (missing); present but not
  parseable per research.md Decision 5 → `401` (malformed); parseable but username/password don't
  match the single `BasicAuthDemoAccount` → `401` (generic, same shape for unknown-username and
  wrong-password, per FR-011/Edge Cases).
