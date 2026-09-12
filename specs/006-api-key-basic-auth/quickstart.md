# Quickstart: API Key & Basic Auth

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values. Every response also carries `X-Request-ID` (omitted from the examples below for brevity).

## Prerequisites

- Server running: `npm run dev`
- `curl` and `jq` available (or substitute any HTTP client)
- The single Basic Auth demo credential documented per `src/data/basicAuthAccount.seed.ts` (see
  data-model.md). Exact username/password are implementation output, not fixed by this guide;
  substitute the values printed in that file or the project README once written.

## Scenario 1 — Issue and use an API key (User Story 1, P1)

```bash
# Issue a new, active API key
ISSUED=$(curl -s -X POST http://localhost:3000/auth/api-key \
  -H "Content-Type: application/json" -d '{"label":"quickstart"}')
KEY=$(echo "$ISSUED" | jq -r .apiKey)
echo "$ISSUED" | jq '{keyId, status, expiresAt}'
# Expect: status == "active", expiresAt == null

# Use it on the protected endpoint
curl -s http://localhost:3000/api-key/protected -H "X-API-Key: $KEY" | jq
# Expect: 200, { "granted": true, "keyId": "...", "label": "quickstart" }

# No header at all
curl -s -o /dev/null -w "missing -> %{http_code}\n" http://localhost:3000/api-key/protected
# Expect: 401

# A key that was never issued
curl -s -o /dev/null -w "unrecognized -> %{http_code}\n" http://localhost:3000/api-key/protected \
  -H "X-API-Key: not-a-real-key"
# Expect: 401
```

**Expected outcome (SC-001, SC-002)**: Issuing a key and successfully calling the protected
endpoint completes in 2 requests; missing/unrecognized keys are consistently rejected with `401`.

## Scenario 2 — Revoke an API key (User Story 2, P2)

```bash
# Revoke the key issued above
curl -s -o /dev/null -w "revoke -> %{http_code}\n" -X POST http://localhost:3000/auth/api-key/revoke \
  -H "X-API-Key: $KEY"
# Expect: 200

# The same key is now rejected
curl -s -o /dev/null -w "post-revoke -> %{http_code}\n" http://localhost:3000/api-key/protected \
  -H "X-API-Key: $KEY"
# Expect: 401

# Revoking it again is still 200 (idempotent)
curl -s -o /dev/null -w "revoke-again -> %{http_code}\n" -X POST http://localhost:3000/auth/api-key/revoke \
  -H "X-API-Key: $KEY"
# Expect: 200

# Revoking a key that was never issued
curl -s -o /dev/null -w "revoke-unknown -> %{http_code}\n" -X POST http://localhost:3000/auth/api-key/revoke \
  -H "X-API-Key: never-issued"
# Expect: 404
```

**Expected outcome (SC-003)**: Revocation takes effect on the very next request, is idempotent on
repeat calls, and correctly reports `404` for a key this system never issued.

## Scenario 3 — Convenience `kind` values for automated testing (User Story 3, P3)

```bash
for KIND in valid expired revoked; do
  ISSUED=$(curl -s -X POST http://localhost:3000/auth/api-key \
    -H "Content-Type: application/json" -d "{\"kind\":\"$KIND\"}")
  KEY=$(echo "$ISSUED" | jq -r .apiKey)
  echo "--- kind=$KIND ---"
  echo "$ISSUED" | jq '{status, expiresAt}'
  curl -s -o /dev/null -w "protected -> %{http_code}\n" http://localhost:3000/api-key/protected \
    -H "X-API-Key: $KEY"
done

# Unknown kind value
curl -s -o /dev/null -w "bad-kind -> %{http_code}\n" -X POST http://localhost:3000/auth/api-key \
  -H "Content-Type: application/json" -d '{"kind":"bogus"}'
# Expect: 400
```

**Expected outcome (SC-002)**: `valid` → `status: active`, `expiresAt: null`, protected → `200`;
`expired` → `status: expired`, protected → `401`; `revoked` → `status: revoked`, protected →
`401` — 100% reproducible across repeated runs, with no dependency on real wall-clock time.

## Scenario 4 — HTTP Basic Auth (User Story 4, P4)

```bash
# Valid demo credentials
curl -s -u "<demo-username>:<demo-password>" http://localhost:3000/auth-test/basic | jq
# Expect: 200, { "authenticated": true, "username": "<demo-username>" }

# Wrong password
curl -s -o /dev/null -w "wrong-password -> %{http_code}\n" \
  -u "<demo-username>:wrong-password" http://localhost:3000/auth-test/basic
# Expect: 401

# Unknown username
curl -s -o /dev/null -w "unknown-username -> %{http_code}\n" \
  -u "nobody:whatever" http://localhost:3000/auth-test/basic
# Expect: 401

# No Authorization header at all
curl -s -o /dev/null -w "missing -> %{http_code}\n" http://localhost:3000/auth-test/basic
# Expect: 401

# Malformed Authorization header (wrong scheme)
curl -s -o /dev/null -w "malformed -> %{http_code}\n" \
  -H "Authorization: Bearer not-basic-auth" http://localhost:3000/auth-test/basic
# Expect: 401
```

**Expected outcome (SC-004)**: Every combination of valid/wrong-password/unknown-username/
missing/malformed Basic Auth credentials produces the expected `200`/`401` outcome, 100%
consistently across repeated runs.

## Docs-surface check (Quality Gates & Spec Parity)

After implementation:

```bash
curl -s http://localhost:3000/api/v1/routes | jq '.[] | select(.path | test("api-key|auth-test"))'
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | map(select(test("api-key|auth-test")))'
```

Confirm every path/operation listed in
`specs/006-api-key-basic-auth/contracts/api-key-basic-auth.openapi.yaml` appears in both outputs,
and nothing else related to this feature is missing or extra — an empty diff between documented
and implemented surface, per the constitution's spec-parity gate.
