# Phase 0 Research: JWT Authentication, Roles & Scopes

All items below were resolvable from CLAUDE.md, the constitution, the existing Spec 001-004 codebase
conventions, and the two decisions already recorded in spec.md's Clarifications session. No
`NEEDS CLARIFICATION` markers remain in the Technical Context.

## Decision 1: JWT library — `jsonwebtoken`, not a hand-rolled signer

**Decision**: Add `jsonwebtoken` (+ `@types/jsonwebtoken`) as a new dependency for signing, verifying,
and decoding tokens.

**Rationale**: This feature's entire purpose is correct JWT semantics (issuer/audience/expiry
validation, distinguishable failure reasons). `jsonwebtoken` is mature, widely used, and throws
distinguishable error types (`TokenExpiredError`, `JsonWebTokenError`, `NotBeforeError`) that map
directly onto the FR-006/FR-014 reason set. Hand-rolling HMAC signing/verification would duplicate
well-trodden crypto-adjacent code for no benefit and risks subtle correctness bugs (timing-safe
comparison, base64url edge cases) — exactly the kind of known-vulnerable-pattern risk the org's
secure-coding guidance calls out avoiding.

**Alternatives considered**: `jose` (more modern, supports JWK/algorithm-agility APIs the project
doesn't need since it only ever uses HS256 with one static secret); hand-rolled `crypto.createHmac`
signer (rejected per above — no test-relevant benefit, more risk).

## Decision 2: Demo credential storage — plaintext, fixed, feature-owned

**Decision**: Four fixed demo accounts (one per documented role: `user`, `admin`, `manager`,
`readonly`), stored as plaintext in a small seed file owned by this feature
(`src/data/demoAccounts.seed.ts`), compared directly (no hashing) during login.

**Rationale**: Per spec.md's Assumptions, these are synthetic testing credentials independent of the
Spec 002 `users` CRUD resource, not real user data — matching how public mock-API tools (e.g.
reqres.in-style fixtures) publish fixed demo logins in their own docs. Password hashing (bcrypt/argon2)
would add a dependency and complexity with no test-value payoff, since the credentials are meant to be
publicly known to testers. The values are still never echoed in any response or log line (constitution
Principle IV, FR-019) — this is about storage form, not exposure.

**Alternatives considered**: bcrypt-hashed passwords (rejected: no realistic threat model for
known-public demo credentials, adds a dependency for no test benefit); reusing the Spec 002 `users`
resource for login (rejected in spec.md's Assumptions — would create a hard dependency on Spec 002,
breaking this spec's parallelizability).

## Decision 3: Session/revocation model — session id (`sid`), not per-jti pairing

**Decision**: Every login or `/auth/token` issuance creates one `Session` record
`{ sid, sub, revoked, currentRefreshJti }` in a new in-memory store keyed by `sid`. Both the access and
refresh JWT carry the same `sid` claim plus a `type: "access" | "refresh"` discriminator. Revocation
(logout, or a deliberately pre-revoked convenience token) is a single `session.revoked = true` write;
every authenticated request is a single O(1) session lookup.

**Rationale**: Simpler than tracking each access/refresh token's `jti` independently, while still
satisfying every acceptance scenario: logout revokes both halves of a pair at once (they share `sid`),
`GET /auth/token-info` can report `revoked` for any token whose session is revoked, and the store never
grows unboundedly (one record per session, not one per token or per request).

**Alternatives considered**: a `Set<jti>` blocklist per revoked token (rejected: requires tracking two
jti's per session and doesn't simplify anything since sessions are the natural revocation unit here).

## Decision 4: Refresh rotation — single-use, no session-wide lockout on reuse

**Decision**: `POST /auth/refresh` requires the presented refresh token's `jti` to equal
`session.currentRefreshJti`. On success, it issues a new access token and a new refresh token (new
`jti`s, same `sid`) and overwrites `currentRefreshJti`. Presenting a stale (already-rotated-away)
refresh token fails with the same `401` reason as a revoked token; the session itself is **not**
otherwise locked out — a client that raced a rotation only needs to keep using its latest pair.

**Rationale**: Satisfies the spec's edge case ("a refresh token replayed after already being rotated
… must be rejected") with the minimum complexity that still demonstrates rotation to testers.
Session-wide lockout-on-reuse-detection (a common production hardening pattern) is not required by any
acceptance scenario here and would add a security-incident-response code path this mock server has no
use for — avoided per the project's "don't design for hypothetical future requirements" guidance.

**Alternatives considered**: full reuse-detection lockout (revoke the whole session on stale-refresh
reuse) — rejected as unrequested scope creep for a testing playground.

## Decision 5: Logout is idempotent for already-revoked tokens, not for never-valid ones

**Decision**: `POST /auth/logout`'s own token check runs the same signature/expiry/issuer/audience
verification as `authenticate`, but — unlike `authenticate` — does **not** treat "session already
revoked" as a failure. If verification of signature/expiry/issuer/audience/type succeeds, logout always
revokes the session and returns `200`, whether or not it was already revoked. If verification itself
fails (bad signature, expired, wrong issuer/audience, malformed), it returns `401`.

**Rationale**: Directly resolves spec.md's edge case: "idempotent success for an already-revoked token
from a prior logout; `401` for a token that was never valid." A plain reuse of the enforcing
`authenticate` middleware (which rejects revoked tokens outright) would make a second `POST /auth/logout`
call incorrectly return `401`, contradicting that requirement.

**Alternatives considered**: reusing `authenticate` unchanged for logout (rejected — produces the wrong
result for the double-logout case above).

## Decision 6: `GET /auth/token-info` bypasses the enforcing `authenticate` middleware

**Decision**: This endpoint reads the token from `Authorization: Bearer <token>` (same convention as
everywhere else) but is handled by its own logic, not the `authenticate` middleware. It first attempts
a structural decode (`jwt.decode(token, { complete: true })`); if that returns `null` (not a
well-formed, base64url/JSON three-segment token) or the header is missing/empty, it returns `400`
(FR-016). Otherwise it always returns `200` with the decoded claims plus a computed `state`:
`valid | expired | invalid-signature | wrong-issuer | wrong-audience | wrong-token-type | revoked`.

**Rationale**: FR-006 explicitly requires this endpoint to report on tokens that are expired, have an
invalid signature, or are revoked — i.e., tokens the normal enforcing middleware exists to reject. Using
`authenticate` here would make it impossible to ever inspect the very states the endpoint is meant to
diagnose.

**Alternatives considered**: gating token-info behind `authenticate` and only decoding on failure
(rejected — conflates two different concerns and produces inconsistent status codes for what should be
uniformly `200`-with-`state`, per acceptance scenario 5 in User Story 2).

## Decision 7: Convenience-issuer mechanics for the four `kind` values

**Decision**:
- `valid`: sign normally with the requested role/scopes, `JWT_EXPIRES_IN` from config, a fresh `sid`
  whose session is not revoked.
- `expired`: sign with an expiry a few seconds in the past (`exp` already elapsed) — deterministically
  triggers `jsonwebtoken`'s `TokenExpiredError` on the very next verification, no need to wait on real
  time.
- `invalid`: sign a normal token, then flip one character within its base64url signature segment
  (third dot-separated part) — keeps it structurally decodable (satisfies FR-006's decode step) while
  guaranteeing signature verification fails.
- `revoked`: sign normally, then immediately mark its session `revoked = true` server-side before
  returning it — well-formed and unexpired, but already revoked on arrival.

**Rationale**: Each mechanism is deterministic and reproducible (constitution Principle II) without
waiting on real wall-clock time or external state, and every kind still round-trips through
`GET /auth/token-info`'s structural-decode step, per FR-006's requirement that decode not depend on the
token still being usable.

## Decision 8: Required role for `GET /api/v1/protected` — fixed as `admin`

**Decision**: The endpoint requires the `admin` role specifically (not configurable).

**Rationale**: CLAUDE.md and spec.md describe this endpoint's purpose as demonstrating 401-vs-403
semantics, not as a configurable authorization demo (that job belongs to `GET /api/v1/role/{role}`,
which is configurable in the sense that every role is tested by definition). Fixing it to the strictest
role gives the clearest, least-ambiguous 401-vs-403 contrast. Making it configurable would add
unrequested scope.

**Alternatives considered**: configurable required role via env var or query param (rejected — no
acceptance scenario asks for this, and CLAUDE.md's `/api/v1/role/{role}` already covers per-role
demonstration).

## Decision 9: No new environment variables

**Decision**: Reuse `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRES_IN`, and `ADMIN_TOKEN`
exactly as already defined in `src/config/env.schema.ts` (from Spec 001). Refresh-token lifetime is a
fixed multiple of `JWT_EXPIRES_IN` (24×) defined as a code constant in `src/auth/jwt.ts`, not a new env
var.

**Rationale**: Every prior spec (001-004) has kept `env.schema.ts` in exact lockstep with CLAUDE.md's
documented `.env.example` list — no spec has added an undocumented env var. CLAUDE.md doesn't ask for
refresh-lifetime configurability, so introducing one would break that established invariant for no
required behavior.

## Decision 10: Scope model reuses existing `USER_ROLES`, adds a parallel `SCOPES` list

**Decision**: `Role` is not a new type — it reuses `UserRole`/`USER_ROLES` already defined in
`src/models/enums.ts` (`["user", "admin", "manager", "readonly"]`) from Spec 002. `Scope` is a new,
parallel const-array-plus-type in the same file: `SCOPES = ["users:read", "users:write",
"products:read", "products:write", "orders:read", "orders:write", "admin"]`. Scope satisfaction is
`tokenScopes.includes(required) || tokenScopes.includes("admin")` (the `admin` scope satisfies every
check, per FR-009/spec User Story 4 acceptance scenario 3).

**Rationale**: Avoids redefining a type that already exists and is already exported for reuse; keeps
the two enumerations (roles vs. scopes) visually and structurally parallel in the same file, matching
the existing convention of grouping related const-arrays together in `enums.ts`.
