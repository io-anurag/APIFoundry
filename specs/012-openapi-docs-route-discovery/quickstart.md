# Quickstart: OpenAPI, Swagger UI & Route Discovery

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values. `jq` is used for readability but any HTTP client works.

## Prerequisites

- Server running: `npm run dev`
- `curl` and `jq` available
- Full automated suite available: `npm test` (this feature adds `tests/routes.test.ts` and
  `tests/routeParity.test.ts` to it)

## Scenario 1 — Machine-readable spec/implementation parity (User Story 1, P1)

```bash
# Fetch the document and list every path it declares.
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | length'
# Expect: 97 (96 pre-existing operations' paths, deduplicated by path, plus /api/v1/routes)

# Confirm JSON and YAML describe the same surface.
curl -s http://localhost:3000/openapi.yaml | python3 -c "import sys, yaml, json; print(len(yaml.safe_load(sys.stdin)['paths']))"
# Expect: the same path count as above

# Confirm the new operation's security requirement and schemas are present.
curl -s http://localhost:3000/openapi.json | jq '.paths["/api/v1/routes"].get.security'
curl -s http://localhost:3000/openapi.json | jq '.components.schemas.RouteInfo, .components.schemas.AuthRequirement'
# Expect: security == [] (unauthenticated); both schemas present, neither using allOf/oneOf/anyOf
```

**Expected outcome (SC-001, SC-005)**: the enforced check is `npm test`'s
`tests/routeParity.test.ts`, which fails the build if the document, the route catalog, or the
live Express route table ever disagree — this manual `curl`/`jq` pass is a spot-check, not the
authoritative gate.

## Scenario 2 — Explore and execute an endpoint from Swagger UI (User Story 2, P2)

1. Open `http://localhost:3000/docs` in a browser.
2. Expand the **Meta** tag and locate `GET /api/v1/routes`.
3. Click "Try it out" → "Execute" with no parameters.
4. Confirm the response body matches a direct call:
   ```bash
   curl -s http://localhost:3000/api/v1/routes | jq '.data | length'
   ```
5. Expand any protected operation (e.g. `GET /auth/me`), use the UI's "Authorize" action with a
   JWT obtained from `POST /auth/token`, then "Try it out" that operation and confirm it succeeds.

**Expected outcome (SC-003)**: every documented operation is reachable and executable from `/docs`
without reading source code, and authenticated "try it out" calls behave identically to direct
authenticated `curl` requests.

## Scenario 3 — Enumerate every route programmatically (User Story 3, P3)

```bash
curl -s http://localhost:3000/api/v1/routes | jq '.data | length'
# Expect: 97

curl -s http://localhost:3000/api/v1/routes | jq '.data[] | select(.path == "/admin/reset")'
# Expect: {"method":"POST","path":"/admin/reset","description":"...","auth":{"type":"adminToken"}}

# Cross-check against the OpenAPI document directly.
diff \
  <(curl -s http://localhost:3000/api/v1/routes | jq -S '[.data[] | {method,path}] | sort_by(.method,.path)') \
  <(curl -s http://localhost:3000/openapi.json | jq -S '[.paths | to_entries[] | .key as $p | (.value | keys[]) as $m | {method: ($m|ascii_upcase), path: $p}] | sort_by(.method,.path)')
# Expect: no output (empty diff)
```

**Expected outcome (SC-002, SC-004)**: `GET /api/v1/routes` lists every implemented route with an
accurate auth requirement, and its entries are a 1:1 match against the OpenAPI document's declared
operations with zero manual cross-referencing required.

## Automated spec-parity gate (Quality Gates & Spec Parity)

```bash
npm test -- tests/routeParity.test.ts
```

**Expected outcome**: passes with zero reported discrepancies between the live Express app's
registered routes, `src/data/routeRegistry.catalog.ts`, and `openapi.yaml`'s `paths` section —
this is the constitution's "document and implementation MUST exactly match" gate enforced as code
rather than left to a manual spot-check, per this feature's core purpose.
