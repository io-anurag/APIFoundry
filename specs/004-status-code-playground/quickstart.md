# Quickstart: Status Code Playground

**Feature**: `004-status-code-playground`

Validates every documented status code, the malformed/out-of-range/unsupported `code` edge cases, and
per-code semantic headers. Schemas are defined in [data-model.md](data-model.md); endpoint contract in
[contracts/status-code-playground.openapi.yaml](contracts/status-code-playground.openapi.yaml).

## Prerequisites

- Node.js 20.x
- Spec 001 (Foundation) implemented and passing (this feature has no dependency on Specs 002/003)

## Setup

```bash
cp .env.example .env
npm install
```

## Run

```bash
npm run dev
# Server listening on http://localhost:3000 (or PORT from .env)
```

## Validate — every documented code returns its exact status (User Story 1)

```bash
for code in 200 201 202 204 301 302 304 400 401 403 404 405 406 408 409 410 415 422 429 500 501 502 503 504; do
  echo -n "code=$code -> "
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/status/$code"
done
```

Each printed status must equal the requested `code`.

## Validate — per-code semantics (User Story 1)

```bash
curl -s -i http://localhost:3000/api/v1/status/200 | head -1   # HTTP/1.1 200, JSON body
curl -s -i http://localhost:3000/api/v1/status/204 | head -1   # HTTP/1.1 204, no body

curl -s -i http://localhost:3000/api/v1/status/301 | grep -i "^location:"  # Location header present
curl -s -i http://localhost:3000/api/v1/status/304 | head -1   # HTTP/1.1 304, no body

curl -s -i http://localhost:3000/api/v1/status/405 | grep -i "^allow:"        # Allow: GET
curl -s -i http://localhost:3000/api/v1/status/429 | grep -i "^retry-after:" # Retry-After present

curl -s http://localhost:3000/api/v1/status/404 | jq .error.code   # "RESOURCE_NOT_FOUND"
curl -s http://localhost:3000/api/v1/status/422 | jq .error.code   # "UNPROCESSABLE_ENTITY"
```

## Validate — determinism (User Story 1 / SC-003)

```bash
diff <(curl -s http://localhost:3000/api/v1/status/500 | jq 'del(.error.requestId)') \
     <(curl -s http://localhost:3000/api/v1/status/500 | jq 'del(.error.requestId)')
# Expect: no diff
```

## Validate — malformed `code` values (User Story 2)

```bash
curl -s -i http://localhost:3000/api/v1/status/abc     # 400 (non-numeric)
curl -s -i http://localhost:3000/api/v1/status/-1      # 400 (negative)
curl -s -i http://localhost:3000/api/v1/status/0       # 400 (zero)
curl -s -i "http://localhost:3000/api/v1/status/200.5" # 400 (decimal)
curl -s -i "http://localhost:3000/api/v1/status/0200"  # 400 (leading zero — rejected, not normalized)
curl -s -i "http://localhost:3000/api/v1/status/%20200%20" # 400 (surrounding whitespace)
curl -s -i http://localhost:3000/api/v1/status/9999999999  # 400 (huge / out of 100-599 range)
```

## Validate — well-formed but unsupported `code` (User Story 3)

```bash
curl -s http://localhost:3000/api/v1/status/418 | jq .error.code  # "UNSUPPORTED_STATUS_CODE"
```

## Automated tests

```bash
npm test
```

Expect coverage of all 24 documented codes' status/headers/body shape, the malformed-`code` edge-case
matrix (non-numeric, negative, zero, decimal, empty, leading-zero, whitespace, huge), the
well-formed-but-unsupported case, determinism across repeated requests, and continued passing of the Spec
001-003 suites.

## Docs surface

```bash
open http://localhost:3000/docs
curl http://localhost:3000/openapi.json
curl http://localhost:3000/openapi.yaml
```

Confirm `/api/v1/status/{code}` is documented with all 24 response entries plus the shared `400` case,
matching exactly what this spec implements.
