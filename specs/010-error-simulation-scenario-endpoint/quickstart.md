# Quickstart: Error Simulation & Generic Scenario Endpoint

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values. Every response also carries `X-Request-ID` (omitted below for brevity).

## Prerequisites

- Server running: `npm run dev`
- `curl` and `jq` available (or substitute any HTTP client)

## Scenario 1 — Dedicated `/errors/*` endpoints (User Story 1, P1)

```bash
for path in validation not-found conflict unauthorized forbidden rate-limit server-error service-unavailable timeout; do
  curl -s -o /dev/null -w "$path -> %{http_code}\n" "http://localhost:3000/errors/$path"
done
# Expect: 400, 404, 409, 401, 403, 429, 500, 503, 408 — in that order, every time

# Credentials never change the outcome:
curl -s -o /dev/null -w "unauthorized-with-token -> %{http_code}\n" \
  -H "Authorization: Bearer not-even-parsed" http://localhost:3000/errors/unauthorized
# Expect: 401 (same as with no header at all)

curl -s -i http://localhost:3000/errors/rate-limit | grep -iE "^(HTTP|Retry-After)"
# Expect: HTTP/1.1 429 ... and a Retry-After header
```

**Expected outcome (SC-001)**: All nine endpoints return their documented status/error code on
every call, independent of headers or credentials.

## Scenario 2 — Generic scenario dispatch (User Story 2, P2)

```bash
for s in success validation-error unauthorized forbidden not-found conflict rate-limit server-error service-unavailable timeout; do
  curl -s -o /dev/null -w "$s -> %{http_code}\n" "http://localhost:3000/api/v1/test?scenario=$s"
done
# Expect: 200, 400, 401, 403, 404, 409, 429, 500, 503, 408 — matching Scenario 1's /errors/* codes exactly

curl -s -o /dev/null -w "unknown -> %{http_code}\n" "http://localhost:3000/api/v1/test?scenario=bogus"
# Expect: 400 (VALIDATION_ERROR, body lists the supported scenario names)

# status escape hatch, including a body-less and a redirect code:
curl -s -o /dev/null -w "status=204 -> %{http_code}\n" "http://localhost:3000/api/v1/test?status=204"
curl -s -D - -o /dev/null "http://localhost:3000/api/v1/test?status=301" | grep -iE "^(HTTP|Location)"
# Expect: 204 with no body; 301 with a Location header

# Redundant vs conflicting status:
curl -s -o /dev/null -w "redundant -> %{http_code}\n" "http://localhost:3000/api/v1/test?scenario=not-found&status=404"
curl -s -o /dev/null -w "conflict -> %{http_code}\n" "http://localhost:3000/api/v1/test?scenario=not-found&status=400"
# Expect: 404 (accepted, matches scenario alone); 400 (rejected as conflicting)
```

**Expected outcome (SC-002, SC-003)**: Every named scenario's status/error code matches its
dedicated `/errors/*` counterpart; any of the 24 status-code-playground codes is reachable via
`status` when no conflicting scenario is given.

## Scenario 3 — Delay, large response, and tunable failure rate (User Story 3, P3)

```bash
START=$(date +%s%3N)
curl -s -o /dev/null "http://localhost:3000/api/v1/test?scenario=delayed&delay=500"
END=$(date +%s%3N)
echo "elapsed: $((END - START))ms (expect >= 500)"

curl -s "http://localhost:3000/api/v1/test?scenario=large-response" | wc -c
# Expect: a byte count close to 1,048,576 (Spec 007's "large" preset)

curl -s -o /dev/null -w "rate=0 -> %{http_code}\n" "http://localhost:3000/api/v1/test?scenario=server-error&failureRate=0"
# Expect: 200, always

curl -s -o /dev/null -w "rate=1 -> %{http_code}\n" "http://localhost:3000/api/v1/test?scenario=server-error&failureRate=1"
# Expect: 500, always

curl -s -o /dev/null -w "default -> %{http_code}\n" "http://localhost:3000/api/v1/test?scenario=server-error"
# Expect: 500, always (no failureRate supplied -> defaults to 1, matching /errors/server-error)

for i in $(seq 1 5); do
  curl -s -o /dev/null -w "%{http_code} " "http://localhost:3000/api/v1/test?scenario=timeout&failureRate=0.5"
done; echo
# Reproducibility: restart the server (or call the test-only reset once Spec 011 exists) and
# confirm this same five-call sequence repeats identically.
```

**Expected outcome (SC-004, SC-005)**: The observed failure proportion is tunable from 0% to 100%
via `failureRate`, reproducible given the same starting PRNG state; delay and payload size stay
within their configured maximums.

## Docs-surface check (Quality Gates & Spec Parity)

After implementation:

```bash
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | map(select(test("^/errors/|^/api/v1/test$")))'
```

Confirm all 10 operations documented in
`specs/010-error-simulation-scenario-endpoint/contracts/error-simulation.openapi.yaml` (the nine
`/errors/*` paths plus `/api/v1/test`) appear, and nothing else related to this feature is missing
or extra — an empty diff between documented and implemented surface, per the constitution's
spec-parity gate.
