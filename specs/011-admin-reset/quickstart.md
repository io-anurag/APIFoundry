# Quickstart: Admin & Reset

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values (`ADMIN_TOKEN=admin-secret`). Every response also carries `X-Request-ID` (omitted below for
brevity).

## Prerequisites

- Server running: `npm run dev`
- `curl` and `jq` available (or substitute any HTTP client)

## Scenario 1 — Data-plane reset (User Story 1, P1)

```bash
# Mutate a few resources first.
curl -s -X DELETE http://localhost:3000/api/v1/products/1 -o /dev/null
curl -s -X DELETE http://localhost:3000/api/v1/users/5 -o /dev/null

# Drive the rate limiter and record an idempotency key (skip if RATE_LIMIT_ENABLED=false locally).
curl -s -o /dev/null http://localhost:3000/rate-limit

# Reset the data plane.
curl -s -X POST http://localhost:3000/admin/reset -H "X-Admin-Token: admin-secret" | jq
# Expect: {"message":"Data reset to seed state","domain":"data","requestId":"..."}

# Confirm every resource is back to its seeded content.
curl -s http://localhost:3000/api/v1/products/1 | jq '.name'
curl -s -o /dev/null -w "user 5 -> %{http_code}\n" http://localhost:3000/api/v1/users/5
# Expect: product 1's original seeded name; user 5 -> 200 (restored, no longer 404)
```

**Expected outcome (SC-001, SC-002)**: every CRUD/read-oriented resource, the rate limiter, and the
idempotency store are back to their original seeded/empty state after one call.

## Scenario 2 — Auth-plane reset, independent of data-plane state (User Story 2, P2)

```bash
# Issue and revoke an API key.
KEY=$(curl -s -X POST http://localhost:3000/auth/api-key | jq -r '.apiKey')
curl -s -X POST http://localhost:3000/auth/api-key/revoke -H "X-API-Key: $KEY" -o /dev/null

# Mutate a data-plane resource so we can prove this reset leaves it alone.
curl -s -X DELETE http://localhost:3000/api/v1/products/2 -o /dev/null

# Reset the auth plane only.
curl -s -X POST http://localhost:3000/admin/auth/reset -H "X-Admin-Token: admin-secret" | jq
# Expect: {"message":"Auth state reset to initial configuration","domain":"auth","requestId":"..."}

# The revoked key is still unrecognized either way, but a *previously valid* key issued before this
# reset is now gone too — and the untouched product-2 deletion survives this call:
curl -s http://localhost:3000/api/v1/products/2 -o /dev/null -w "product-2 after auth reset -> %{http_code}\n"
# Expect: 404 — proving /admin/auth/reset did NOT restore data-plane state
```

**Expected outcome (SC-003)**: previously issued tokens/API keys are unrecognized after this call,
while unrelated resource data mutated beforehand is left exactly as it was.

## Scenario 3 — Rejecting unauthorized reset attempts (User Story 3, P3)

```bash
curl -s -o /dev/null -w "no-header -> %{http_code}\n" -X POST http://localhost:3000/admin/reset
curl -s -o /dev/null -w "wrong-token -> %{http_code}\n" -X POST http://localhost:3000/admin/reset \
  -H "X-Admin-Token: not-the-real-token"
# Expect: 401 (no header); 403 (wrong token)

# Confirm no side effect: mutate, get rejected, confirm the mutation is still present.
curl -s -X DELETE http://localhost:3000/api/v1/products/3 -o /dev/null
curl -s -o /dev/null -X POST http://localhost:3000/admin/reset -H "X-Admin-Token: wrong"
curl -s http://localhost:3000/api/v1/products/3 -o /dev/null -w "product-3 still deleted -> %{http_code}\n"
# Expect: 404 (the rejected reset attempt performed no reset)
```

**Expected outcome (SC-004)**: every reset attempt with a missing or incorrect admin credential is
rejected with no observable state change.

## Docs-surface check (Quality Gates & Spec Parity)

After implementation:

```bash
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | map(select(test("^/admin/")))'
curl -s http://localhost:3000/openapi.json | jq '.components.securitySchemes.adminTokenAuth'
```

Confirm both operations documented in `specs/011-admin-reset/contracts/admin-reset.openapi.yaml`
(`/admin/reset`, `/admin/auth/reset`) appear, the `adminTokenAuth` security scheme is present, and
nothing else related to this feature is missing or extra — an empty diff between documented and
implemented surface, per the constitution's spec-parity gate.
