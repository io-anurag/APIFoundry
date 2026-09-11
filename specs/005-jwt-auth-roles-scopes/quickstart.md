# Quickstart: JWT Authentication, Roles & Scopes

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server is
running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env` values.
Every response also carries `X-Request-ID` (omitted from the examples below for brevity).

## Prerequisites

- Server running: `npm run dev`
- `curl` and `jq` available (or substitute any HTTP client)
- Demo accounts documented per `src/data/demoAccounts.seed.ts` (see data-model.md) — one per role:
  `user`, `admin`, `manager`, `readonly`. Exact usernames/passwords are implementation output, not
  fixed by this guide; substitute the values printed in that file or the project README once written.

## Scenario 1 — Login → identity → logout (User Story 1, P1)

```bash
# Login as the admin demo account
LOGIN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<admin-demo-username>","password":"<admin-demo-password>"}')
ACCESS=$(echo "$LOGIN" | jq -r .accessToken)
REFRESH=$(echo "$LOGIN" | jq -r .refreshToken)

# Confirm identity
curl -s http://localhost:3000/auth/me -H "Authorization: Bearer $ACCESS" | jq
# Expect: { "sub": "...", "role": "admin", "scopes": [...] }

# Refresh — rotates both tokens
ROTATED=$(curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
NEW_ACCESS=$(echo "$ROTATED" | jq -r .accessToken)

# Reusing the OLD refresh token now fails (single-use rotation)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}"
# Expect: 401

# Logout with the new access token
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $NEW_ACCESS"
# Expect: 200

# The same (now-revoked) token is rejected on next use
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/auth/me -H "Authorization: Bearer $NEW_ACCESS"
# Expect: 401

# Logging out again with the same token is still 200 (idempotent, Decision 5)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $NEW_ACCESS"
# Expect: 200
```

**Expected outcome (SC-001)**: The full login → identity-check → logout cycle completes in 3-4
requests, and the logged-out token is verifiably rejected on its next use.

## Scenario 2 — Convenience tokens for every failure mode (User Story 2, P2)

```bash
for KIND in valid expired invalid revoked; do
  TOKEN=$(curl -s -X POST http://localhost:3000/auth/token \
    -H "Content-Type: application/json" \
    -d "{\"role\":\"admin\",\"scopes\":[\"admin\"],\"kind\":\"$KIND\"}" | jq -r .accessToken)

  echo "--- kind=$KIND ---"
  curl -s http://localhost:3000/auth/token-info -H "Authorization: Bearer $TOKEN" | jq .state
  curl -s -o /dev/null -w "protected -> %{http_code}\n" http://localhost:3000/api/v1/protected \
    -H "Authorization: Bearer $TOKEN"
done
```

**Expected outcome (SC-002)**: `token-info` reports `valid`/`expired`/`invalid-signature`/`revoked`
respectively; `/api/v1/protected` returns `200` only for `valid`, `401` for the other three — 100%
reproducible across repeated runs.

## Scenario 3 — 401 vs 403 vs 200, and role enforcement (User Story 3, P3)

```bash
# No token at all
curl -s -o /dev/null -w "no-token -> %{http_code}\n" http://localhost:3000/api/v1/protected
# Expect: 401

# Valid token, wrong role (readonly, endpoint requires admin)
READONLY=$(curl -s -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"role":"readonly","scopes":[],"kind":"valid"}' | jq -r .accessToken)
curl -s -o /dev/null -w "wrong-role -> %{http_code}\n" http://localhost:3000/api/v1/protected \
  -H "Authorization: Bearer $READONLY"
# Expect: 403

# Every role against its own /api/v1/role/{role} demo
for ROLE in user admin manager readonly; do
  TOKEN=$(curl -s -X POST http://localhost:3000/auth/token \
    -H "Content-Type: application/json" \
    -d "{\"role\":\"$ROLE\",\"scopes\":[],\"kind\":\"valid\"}" | jq -r .accessToken)
  curl -s -o /dev/null -w "$ROLE self -> %{http_code}\n" http://localhost:3000/api/v1/role/$ROLE \
    -H "Authorization: Bearer $TOKEN"
  curl -s -o /dev/null -w "$ROLE vs user -> %{http_code}\n" http://localhost:3000/api/v1/role/user \
    -H "Authorization: Bearer $TOKEN"
done

# Invalid role path value
curl -s -o /dev/null -w "bad-role -> %{http_code}\n" http://localhost:3000/api/v1/role/superadmin \
  -H "Authorization: Bearer $READONLY"
# Expect: 400
```

**Expected outcome (SC-003, SC-004)**: `no-token` is `401`; `wrong-role` is `403`; each role's `self`
check is `200` and its `vs user` check is `403` unless the role *is* `user` (then `200`); `bad-role` is
`400`. Authentication failures (401) and authorization failures (403) are distinguishable by status
code alone across every case.

## Scenario 4 — Scope enforcement (User Story 4, P4)

```bash
# Token with only products:read
LIMITED=$(curl -s -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"role":"user","scopes":["products:read"],"kind":"valid"}' | jq -r .accessToken)

curl -s -o /dev/null -w "matching-scope -> %{http_code}\n" http://localhost:3000/api/v1/scope/products:read \
  -H "Authorization: Bearer $LIMITED"
# Expect: 200

curl -s http://localhost:3000/api/v1/scope/orders:write -H "Authorization: Bearer $LIMITED" | jq
# Expect: 403 with error.code == "INSUFFICIENT_SCOPE"

# Admin scope satisfies every check
ADMIN_SCOPE=$(curl -s -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","scopes":["admin"],"kind":"valid"}' | jq -r .accessToken)
curl -s -o /dev/null -w "admin-override -> %{http_code}\n" http://localhost:3000/api/v1/scope/orders:write \
  -H "Authorization: Bearer $ADMIN_SCOPE"
# Expect: 200
```

**Expected outcome**: matching scope → `200`; missing scope → `403` / `INSUFFICIENT_SCOPE`; the
`admin` scope satisfies any scope check regardless of the path's specific scope.

## Docs-surface check (Quality Gates & Spec Parity)

After implementation:

```bash
curl -s http://localhost:3000/api/v1/routes | jq '.[] | select(.path | test("auth|protected|role|scope"))'
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | map(select(test("auth|protected|role|scope")))'
```

Confirm every path/operation listed in
`specs/005-jwt-auth-roles-scopes/contracts/jwt-auth-roles-scopes.openapi.yaml` appears in both outputs,
and nothing else related to auth is missing or extra — an empty diff between documented and implemented
surface, per the constitution's spec-parity gate.
