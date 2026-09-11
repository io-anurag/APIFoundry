# Phase 1 Data Model: JWT Authentication, Roles & Scopes

Entities derived from spec.md's Key Entities section and research.md's session/rotation decisions. None
of these are persisted stores in the CRUD sense — `DemoAccount` is static seed data, `Session` is
transient in-memory state reset between tests and by the future admin/reset feature (Spec 011).

## Role (reused, not new)

Already defined in `src/models/enums.ts` (Spec 002):

```ts
export const USER_ROLES = ["user", "admin", "manager", "readonly"] as const;
export type UserRole = (typeof USER_ROLES)[number];
```

This feature reuses `UserRole` as its `Role` type — no redefinition.

## Scope (new)

```ts
export const SCOPES = [
  "users:read",
  "users:write",
  "products:read",
  "products:write",
  "orders:read",
  "orders:write",
  "admin",
] as const;
export type Scope = (typeof SCOPES)[number];
```

- The `admin` scope is special: `hasScope(tokenScopes, required)` returns `true` whenever
  `tokenScopes.includes("admin")`, regardless of `required` (FR-009).

## DemoAccount

| Field | Type | Notes |
|---|---|---|
| `username` | `string` | Unique; one of 4 fixed values, one per role |
| `password` | `string` | Plaintext (Decision 2); never included in any response/log |
| `role` | `UserRole` | The account's single role |
| `scopes` | `Scope[]` | Default scope set granted on login (role-appropriate subset; the `admin` account's set includes `"admin"`) |

Exactly 4 records, one per `UserRole` value, defined in `src/data/demoAccounts.seed.ts`. Not a
mutable store — no create/update/delete lifecycle.

## Session (new in-memory store)

| Field | Type | Notes |
|---|---|---|
| `sid` | `string` (UUID) | Primary key; shared by an access/refresh token pair |
| `sub` | `string` | The demo account's `username` (or a synthetic subject for convenience-issued tokens) |
| `revoked` | `boolean` | Set `true` by logout or by the `revoked` convenience-kind at issuance |
| `currentRefreshJti` | `string \| null` | The one refresh token `jti` currently valid for this session; `null` for sessions with no refresh token (e.g. convenience-issued access-only tokens) |

Keyed by `sid` in `src/data/session.store.ts`, following the existing `keyedStore.ts` pattern
(`get`, `set`, `has`, `reset`). Bounded by request volume; `reset()` is called from
`tests/helpers/resetStores.ts` between tests.

## AccessTokenClaims (JWT payload shape)

| Claim | Type | Notes |
|---|---|---|
| `sub` | `string` | Matches `Session.sub` |
| `role` | `UserRole` | |
| `scopes` | `Scope[]` | |
| `sid` | `string` | Session id — links to the `Session` record |
| `type` | `"access"` | Discriminator; rejected as wrong-token-type if presented where a refresh token is expected |
| `iss` | `string` | `config.jwtIssuer` |
| `aud` | `string` | `config.jwtAudience` |
| `iat` / `exp` | `number` | Standard JWT timestamp claims |
| `jti` | `string` (UUID) | Unique per access token |

## RefreshTokenClaims (JWT payload shape)

Same shape as `AccessTokenClaims` except `type: "refresh"` and a longer `exp` (24× `JWT_EXPIRES_IN`,
Decision 9). `jti` here is the value tracked as `Session.currentRefreshJti`.

## TokenInfoState (computed, not stored)

```ts
type TokenInfoState =
  | "valid"
  | "expired"
  | "invalid-signature"
  | "wrong-issuer"
  | "wrong-audience"
  | "wrong-token-type"
  | "revoked";
```

Returned by `GET /auth/token-info` alongside the decoded claims (Decision 6). Computed fresh on every
request — not persisted.

## Relationships

```text
DemoAccount (1) ──login──> Session (many over time, one active pair at a time)
Session (1) ──claims.sid──> AccessTokenClaims (many, historically; only the latest is unrevoked-valid)
Session (1) ──claims.sid + currentRefreshJti──> RefreshTokenClaims (one current, per rotation)
```

## Validation rules (from Functional Requirements)

- `POST /auth/login` body: `username` (non-empty string), `password` (non-empty string) — missing/wrong
  type → `400`; unknown username or wrong password → `401` (same shape for both, FR-014/edge cases).
- `POST /auth/token` body: `role` (must be one of `USER_ROLES`), `scopes` (array, each element one of
  `SCOPES`), `kind` (one of `valid | expired | invalid | revoked`) — any unknown value → `400`/`422`
  (FR-016).
- `POST /auth/refresh` body: `refreshToken` (non-empty string) — missing/wrong type → `400`; fails
  verification or is stale/revoked → `401`.
- `GET /api/v1/role/{role}` path param: must be one of `USER_ROLES` → else `400` (FR-008).
- `GET /api/v1/scope/{scope}` path param: must be one of `SCOPES` → else `400` (FR-009, mirroring
  FR-008's role validation).
