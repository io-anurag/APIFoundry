# Quickstart: HTTP Testing Utilities

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values (`MAX_DELAY_MS=10000`, `MAX_PAYLOAD_SIZE=10mb`). Every response also carries
`X-Request-ID` (omitted from the examples below for brevity).

## Prerequisites

- Server running: `npm run dev`
- `curl` and `jq` available (or substitute any HTTP client)

## Scenario 1 — Delay (User Story 1, P1)

```bash
# A 300ms delay actually takes at least 300ms
time curl -s http://localhost:3000/delay/300 | jq
# Expect: { "delayMs": 300 }, wall-clock time >= 0.3s

# Same via query parameter
curl -s "http://localhost:3000/delay?ms=300" | jq

# Zero delay resolves immediately
curl -s -o /dev/null -w "zero -> %{http_code}\n" http://localhost:3000/delay/0

# Over the configured maximum is rejected immediately, never actually waiting
time curl -s -o /dev/null -w "too-long -> %{http_code}\n" http://localhost:3000/delay/999999
# Expect: 400, near-instant

# Malformed values
curl -s -o /dev/null -w "non-numeric -> %{http_code}\n" http://localhost:3000/delay/abc
curl -s -o /dev/null -w "negative -> %{http_code}\n" http://localhost:3000/delay/-5
curl -s -o /dev/null -w "decimal -> %{http_code}\n" http://localhost:3000/delay/100.5
```

**Expected outcome (SC-001)**: Responses never arrive sooner than the requested delay; anything
over `MAX_DELAY_MS` or malformed is rejected with `400` immediately.

## Scenario 2 — Bounded payload generation (User Story 2, P2)

```bash
for PRESET in small medium large; do
  BYTES=$(curl -s http://localhost:3000/payload/$PRESET | wc -c)
  echo "$PRESET -> $BYTES bytes"
done
# Expect: small ~1024, medium ~102400, large ~1048576 (exact per data-model.md)

curl -s "http://localhost:3000/payload?size=2048" | wc -c
# Expect: 2048

curl -s -o /dev/null -w "over-max -> %{http_code}\n" "http://localhost:3000/payload?size=999999999"
# Expect: 400

curl -s -o /dev/null -w "bad-preset -> %{http_code}\n" http://localhost:3000/payload/huge
# Expect: 400
```

**Expected outcome (SC-002)**: Every preset and explicit in-bounds size produces a body of that
exact size; over-maximum requests are rejected before any oversized body is generated.

## Scenario 3 — Payload echo (User Story 3, P3)

```bash
curl -s -X POST http://localhost:3000/payload -H "Content-Type: application/json" \
  -d '{"hello":"world"}' | jq
# Expect: { "received": true, "contentLength": 18 }

curl -s -X POST http://localhost:3000/payload -H "Content-Type: application/json" \
  -d '{"nested":{"a":[1,2,3]},"arr":[{"x":1}]}' | jq .contentLength

curl -s -o /dev/null -w "empty-body -> %{http_code}\n" -X POST http://localhost:3000/payload \
  -H "Content-Type: application/json"
# Expect: 200

curl -s -o /dev/null -w "invalid-json -> %{http_code}\n" -X POST http://localhost:3000/payload \
  -H "Content-Type: application/json" -d '{not valid json'
# Expect: 400

# Oversized body (requires a body larger than MAX_PAYLOAD_SIZE; shown here against a
# temporarily-lowered limit for a fast local check)
head -c 11000000 /dev/zero | tr '\0' 'a' | \
  curl -s -o /dev/null -w "oversized -> %{http_code}\n" -X POST http://localhost:3000/payload \
  -H "Content-Type: application/json" --data-binary @-
# Expect: 413 (against the default 10mb MAX_PAYLOAD_SIZE)
```

**Expected outcome (SC-003)**: Every well-formed body (any size/shape within the maximum) gets
back an exactly accurate `contentLength`; malformed JSON is `400`; oversized bodies are `413`.

## Scenario 4 — Content types (User Story 4, P4)

```bash
for TYPE in json text html xml; do
  curl -s -D - -o /dev/null http://localhost:3000/content/$TYPE | grep -i "^content-type"
done

curl -s -o /dev/null -w "bad-type -> %{http_code}\n" http://localhost:3000/content/csv
# Expect: 400

# Matching Content-Type is accepted
curl -s -X POST http://localhost:3000/content/json -H "Content-Type: application/json" -d '{}' | jq
# Expect: { "accepted": true, "type": "json" }

# Mismatched Content-Type is rejected
curl -s -o /dev/null -w "mismatch -> %{http_code}\n" -X POST http://localhost:3000/content/json \
  -H "Content-Type: text/plain" -d 'not json'
# Expect: 415
```

**Expected outcome (SC-004)**: Each content type returns the correct header and body; matching
`POST` Content-Type is accepted, mismatched is rejected with `415`.

## Scenario 5 — Header echo (User Story 5, P5)

```bash
curl -s http://localhost:3000/headers -H "X-Custom-Header: hello" \
  -H "Authorization: Bearer should-not-appear" \
  -H "Cookie: session=should-not-appear" \
  -H "X-API-Key: should-not-appear" | jq
# Expect: headers.x-custom-header == "hello"; no authorization/cookie/x-api-key keys anywhere in the body
```

**Expected outcome (SC-005)**: Ordinary headers are echoed exactly; `Authorization`, `Cookie`, and
`X-API-Key` never appear in the response body.

## Scenario 6 — Cookies (User Story 6, P6)

```bash
curl -s http://localhost:3000/cookies | jq
# Expect: { "cookies": {} }

# Set two independent cookies
SET1=$(curl -s -i -X POST http://localhost:3000/cookies -H "Content-Type: application/json" \
  -d '{"name":"a","value":"1"}')
SET2=$(curl -s -i -X POST http://localhost:3000/cookies -H "Content-Type: application/json" \
  -d '{"name":"b","value":"2"}')

# Resend both cookies and confirm both are reported
curl -s http://localhost:3000/cookies -H "Cookie: a=1; b=2" | jq
# Expect: { "cookies": { "a": "1", "b": "2" } }

# Clear just one
curl -s -X DELETE "http://localhost:3000/cookies?name=a" | jq
# Expect: { "cleared": true, "name": "a" }

# Missing name
curl -s -o /dev/null -w "missing-name -> %{http_code}\n" -X DELETE http://localhost:3000/cookies
# Expect: 400
curl -s -o /dev/null -w "missing-body -> %{http_code}\n" -X POST http://localhost:3000/cookies \
  -H "Content-Type: application/json" -d '{}'
# Expect: 400
```

**Expected outcome (SC-006)**: A full set → read-back → clear cycle works in three requests, and
multiple independently-named cookies coexist correctly.

## Docs-surface check (Quality Gates & Spec Parity)

After implementation:

```bash
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | map(select(test("delay|payload|content|headers|cookies")))'
```

Confirm all 11 paths/operations listed in
`specs/007-http-testing-utilities/contracts/http-testing-utilities.openapi.yaml` appear, and
nothing else related to this feature is missing or extra — an empty diff between documented and
implemented surface, per the constitution's spec-parity gate.
