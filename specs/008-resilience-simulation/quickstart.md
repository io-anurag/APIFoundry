# Quickstart: Resilience Simulation

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values (`RATE_LIMIT_ENABLED=false`, `RATE_LIMIT_REQUESTS=100`, `RATE_LIMIT_WINDOW_MS=60000`,
`FAILURE_RATE=0`). Every response also carries `X-Request-ID` (omitted below for brevity).

## Prerequisites

- Server running: `npm run dev`
- `curl` and `jq` available (or substitute any HTTP client)
- For the rate-limit scenario, temporarily set `RATE_LIMIT_ENABLED=true` and a low
  `RATE_LIMIT_REQUESTS` (e.g. `3`) in `.env` so the threshold is reachable quickly, then restart
  the server.

## Scenario 1 — Rate limiting (User Story 1, P1)

```bash
# With RATE_LIMIT_ENABLED=true, RATE_LIMIT_REQUESTS=3, RATE_LIMIT_WINDOW_MS=60000:
for i in 1 2 3; do
  curl -s -o /dev/null -w "request $i -> %{http_code}\n" http://localhost:3000/rate-limit
done
# Expect: 200, 200, 200

curl -s -D - -o /dev/null http://localhost:3000/rate-limit | grep -iE "^(HTTP|Retry-After)"
# Expect: HTTP/1.1 429 ... and a Retry-After header with a positive integer

# Wait out the window (RATE_LIMIT_WINDOW_MS), then confirm it resets
sleep 61
curl -s -o /dev/null -w "after window -> %{http_code}\n" http://localhost:3000/rate-limit
# Expect: 200
```

**Expected outcome (SC-001)**: The threshold is enforced exactly, `Retry-After` is present and
usable on `429`, and the limit resets deterministically once the window elapses.

## Scenario 2 — Flaky, reproducible failures (User Story 2, P2)

```bash
curl -s -o /dev/null -w "rate=0 -> %{http_code}\n" "http://localhost:3000/flaky?failureRate=0"
# Expect: 200, always

curl -s -o /dev/null -w "rate=1 -> %{http_code}\n" "http://localhost:3000/flaky?failureRate=1"
# Expect: one of 500/502/503/504, always

curl -s -o /dev/null -w "invalid -> %{http_code}\n" "http://localhost:3000/flaky?failureRate=2"
# Expect: 400

# Reproducibility: restart the server (or call the test-only reset once Spec 011 exists) between
# these two blocks and confirm the sequence of outcomes at failureRate=0.5 is identical both times
for i in $(seq 1 5); do
  curl -s -o /dev/null -w "%{http_code} " "http://localhost:3000/flaky?failureRate=0.5"
done; echo
```

**Expected outcome (SC-002)**: `failureRate=0`/`1` are single-outcome-deterministic; a fixed
starting state (fresh process or reset) reproduces the same pass/fail sequence across runs.

## Scenario 3 — Idempotent payments (User Story 3, P3)

```bash
KEY=$(node -e "console.log(require('crypto').randomUUID())")
BODY='{"orderId":1,"amount":42.5,"status":"pending"}'

# First call: creates a new payment
curl -s -i -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d "$BODY" \
  | tee /tmp/first.txt | grep -i "^HTTP"
# Expect: 201

# Exact retry: same key, same body -> replays the same payment, 200
curl -s -o /dev/null -w "retry -> %{http_code}\n" -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d "$BODY"
# Expect: 200

# Same key, different body -> conflict
curl -s -o /dev/null -w "conflict -> %{http_code}\n" -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" \
  -d '{"orderId":1,"amount":99,"status":"pending"}'
# Expect: 409

# Missing Idempotency-Key
curl -s -o /dev/null -w "missing-key -> %{http_code}\n" -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" -d "$BODY"
# Expect: 400
```

**Expected outcome (SC-003)**: A same-key-same-body retry never creates a second payment; a
same-key-different-body reuse is always rejected with `409`.

## Scenario 4 — Cached responses (User Story 4, P4)

```bash
ETAG=$(curl -s -D - -o /dev/null http://localhost:3000/cache/resource | grep -i "^etag" | cut -d' ' -f2 | tr -d '\r')
echo "current ETag: $ETAG"

curl -s -o /dev/null -w "matching -> %{http_code}\n" -H "If-None-Match: $ETAG" http://localhost:3000/cache/resource
# Expect: 304

curl -s -X PUT http://localhost:3000/cache/resource -H "Content-Type: application/json" \
  -d '{"content":{"changed":true}}' | jq
# Expect: 200 with a new version/ETag

curl -s -o /dev/null -w "stale -> %{http_code}\n" -H "If-None-Match: $ETAG" http://localhost:3000/cache/resource
# Expect: 200 (the old ETag no longer matches)
```

**Expected outcome (SC-004)**: A fetch → conditional-refetch → change → conditional-refetch cycle
returns `304` exactly when unchanged and `200` with fresh validators exactly when changed.

## Docs-surface check (Quality Gates & Spec Parity)

After implementation:

```bash
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | map(select(test("rate-limit|flaky|cache/resource"))) '
curl -s http://localhost:3000/openapi.json | jq '.paths["/api/v1/payments"].post'
```

Confirm all 5 operations documented in
`specs/008-resilience-simulation/contracts/resilience-simulation.openapi.yaml` appear (the 4 new
top-level paths plus the new `POST` on the existing `/api/v1/payments` path), and nothing else
related to this feature is missing or extra — an empty diff between documented and implemented
surface, per the constitution's spec-parity gate.
