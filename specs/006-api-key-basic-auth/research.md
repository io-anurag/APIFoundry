# Phase 0 Research: API Key & Basic Auth

All items below were resolvable from CLAUDE.md, the constitution, the existing Spec 001-005
codebase conventions, and the three decisions already recorded in spec.md's Clarifications
session. No `NEEDS CLARIFICATION` markers remain in the Technical Context.

## Decision 1: API key storage — keyed by the raw key value itself, not a separate id

**Decision**: `ApiKey.id` (the field the generic `KeyedStore<T extends { id: string }>` requires)
holds the raw, opaque key value itself. A separate `keyId` field holds a non-secret, human-facing
identifier (`randomUUID()`) shown to callers for correlation/labeling purposes only — it is never
used for lookup.

**Rationale**: `GET /api-key/protected` and `POST /auth/api-key/revoke` both receive the raw key
value via the `X-API-Key` header (per the Clarifications session's answer on the revoke
mechanism) and must resolve it to a record in O(1), per the constitution's bounded-resource
principle. Keying the store by the value the caller actually presents avoids a linear scan and
needs no secondary index. This exactly mirrors Spec 005's `Session` record, whose `id` field
holds the JWT `sid` claim (the value actually used to look sessions up) rather than an unrelated
synthetic id — an established, working pattern in this codebase.

**Alternatives considered**: a separate `id`-keyed store with a secondary `Map<rawKey, id>`
index (rejected — two data structures to keep in sync for no benefit, since nothing in this
feature ever looks a key up by its `keyId`); hashing the raw key before storage, comparable to a
password hash (rejected — this is a mock server's opaque bearer credential, not a real password;
the constitution's threat model here is "never log or echo it," which storage-form hashing
doesn't materially improve, and Spec 005's Decision 2 already established this project's stance
on not adding hashing complexity for synthetic testing credentials).

## Decision 2: API key generation — `crypto.randomBytes(32).toString("hex")`

**Decision**: Each issued key's value is 32 random bytes rendered as a 64-character hex string via
Node's built-in `node:crypto` module — no new dependency.

**Rationale**: Needs to be opaque and unguessable (FR-005) with no external library required;
`node:crypto` is already used by this codebase for `randomUUID()` (Spec 005's `src/auth/jwt.ts`).
Hex encoding keeps the value URL/header-safe with zero encoding edge cases, unlike base64
(`+`/`/`/`=` are technically valid in an HTTP header value but needlessly complicate copy-paste
and logging-redaction pattern-matching). Uniqueness across all issued keys (FR-005) is guaranteed
probabilistically by 256 bits of entropy — the same collision-safety argument already accepted
for `randomUUID()`-keyed sessions.

**Alternatives considered**: `randomUUID()` (rejected — only 122 bits of entropy and a
recognizable UUID shape that testing tools might mistake for a resource id rather than a bearer
secret); a prefixed/structured key like `ak_<random>` (rejected — no acceptance scenario asks for
a recognizable prefix, and CLAUDE.md doesn't request one; adding it would be unrequested scope).

## Decision 3: `kind` convenience parameter mirrors `POST /auth/token`'s mechanics

**Decision**:
- `valid` (default): generated normally, `expiresAt: null`, `revoked: false`. Never transitions to
  expired or revoked on its own (per the Clarifications session — no custom-TTL field exists).
- `expired`: `expiresAt` is set a fixed offset in the past at issuance time (mirroring Spec 005's
  `EXPIRED_OFFSET_SECONDS` constant) — deterministically already-expired, forever, without
  depending on real wall-clock time elapsing.
- `revoked`: `revoked: true` is set at issuance time, before the response is returned.

**Rationale**: Directly mirrors research.md Decision 7 from Spec 005 (the JWT convenience-issuer
pattern this spec's Assumptions section explicitly cites as its model), keeping the two auth
features' test-support ergonomics consistent for anyone who has already used one of them. Setting
`expired` keys' expiry in the past (rather than, say, a few milliseconds in the future) keeps
every outcome deterministic and reproducible regardless of test execution speed (constitution
Principle II) — there is no race condition to avoid since, unlike JWTs, this feature has no
`valid`-kind expiry at all to accidentally trigger.

**Alternatives considered**: a fourth `kind: invalid` mirroring the JWT set's structurally-corrupt
option (rejected — an API key is an opaque, unstructured string with no signature to corrupt;
"invalid" and "unrecognized" collapse to the same observable case for an opaque credential, and
CLAUDE.md's own case list for API keys is "valid/invalid/missing/expired/revoked" where "invalid"
already means exactly "not a key this system issued," which FR-005/FR-010 already cover via the
default 401 for any unrecognized `X-API-Key` value — no separate `kind` value adds test coverage
that doesn't already exist).

## Decision 4: Basic Auth demo credential — one fixed, feature-owned account, plaintext

**Decision**: A single fixed username/password pair, stored as a plaintext constant in
`src/data/basicAuthAccount.seed.ts`, independent of Spec 005's demo accounts and the Spec 002
`users` resource (per the Clarifications session).

**Rationale**: Directly reuses Spec 005 research.md Decision 2's reasoning: this is a
synthetic, publicly-documented testing credential, not real user data, so password hashing adds
complexity with no test-value payoff. A single account (not four, one per role) is sufficient
because this endpoint exists to prove the Basic Auth mechanism itself — missing/malformed/wrong
password/wrong username — not to demonstrate roles, which is already Spec 005's job.

**Alternatives considered**: four accounts mirroring the JWT roles (rejected per the
Clarifications session — would duplicate role modeling across two unrelated auth mechanisms for
no acceptance-scenario benefit); reusing Spec 005's demo accounts directly (rejected — would
create a hard dependency on Spec 005, breaking this spec's parallelizability, exactly as Spec
005 itself rejected reusing the Spec 002 `users` resource for the same reason).

## Decision 5: Basic Auth header parsing — strict decode, first-colon split, never throws

**Decision**: `src/auth/basicAuth.ts` exposes a pure `parseBasicAuthHeader(header: string |
undefined)` function that: returns `null` if the header is missing or does not start with
`"Basic "`; returns `null` if the remainder is not valid base64; otherwise decodes it and splits
on the **first** `:` only (per HTTP Basic Auth convention — a password may itself contain a
colon), returning `{ username, password }`. Any `null` result is a "malformed" 401, distinct from
a well-formed-but-wrong-credential 401 (FR-011).

**Rationale**: Directly satisfies the spec's edge case about a decoded payload containing a colon
in the username or password, and keeps parsing a single pure function with no thrown exceptions
(matching this codebase's established style, e.g. `src/auth/jwt.ts`'s `decodeToken`/`verifyToken`,
which return typed results rather than relying on callers to catch exceptions).

**Alternatives considered**: rejecting any colon inside the decoded username/password as
malformed (rejected — the spec's edge case explicitly requires handling this per the standard
convention, not treating it as an error).

## Decision 6: No new environment variables

**Decision**: No new `.env` keys. The Basic Auth demo credential and the API key generation
scheme are both code constants, not configuration.

**Rationale**: CLAUDE.md's `.env.example` list has no API-key- or Basic-Auth-specific entries,
and every prior spec (001-005) has kept `env.schema.ts` in exact lockstep with that documented
list — introducing an undocumented env var here would break that established invariant for no
CLAUDE.md-requested behavior.

**Alternatives considered**: an env-configurable Basic Auth username/password (rejected — no
acceptance scenario or CLAUDE.md line asks for this; Spec 005's demo accounts are code constants
for the same reason).

## Decision 7: Route mounting — top-level, outside `/api/v1`, alongside `authRouter`

**Decision**: `POST /auth/api-key` and `POST /auth/api-key/revoke` mount on a new `apiKeyRouter`;
`GET /api-key/protected` mounts on the same router; `GET /auth-test/basic` mounts on a new
`basicAuthRouter`. Both routers are wired into `src/app.ts` at the top level (alongside
`authRouter`), not under the versioned `apiRouter`.

**Rationale**: CLAUDE.md spells every one of these paths without the `/api/v1` prefix, exactly as
it does for Spec 005's `/auth/*` endpoints — this feature's paths are peers of those, not
resource endpoints under the versioned API surface. Matches Spec 005's own precedent (research.md
Decision — route mounting) of following CLAUDE.md's literal path spelling rather than
normalizing every auth-related path under one prefix.

**Alternatives considered**: mounting everything under `/api/v1` for consistency with CRUD
resources (rejected — would contradict CLAUDE.md's explicit path list and Spec 005's established
precedent).
