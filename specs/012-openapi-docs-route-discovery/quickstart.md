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
# Fetch the document and count distinct path keys (NOT the same as operation count — many paths
# carry several HTTP methods, and some path items also carry a shared `parameters` key alongside
# their methods, so a naive `.paths | keys | length` undercounts operations; filter to real HTTP
# methods to count operations instead).
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | length'
# Expect: 73 distinct path strings

curl -s http://localhost:3000/openapi.json | \
  jq '[.paths[] | keys[] | select(IN("get","post","put","patch","delete"))] | length'
# Expect: 99 total operations (98 pre-existing — including /openapi.json and /openapi.yaml
# documenting themselves — plus /api/v1/routes)

# Confirm JSON and YAML describe the same path surface (Node here, not python3/pyyaml, to match
# this project's own toolchain — js-yaml is already a dependency).
node -e "const yaml=require('js-yaml'); const https=require('http'); \
  https.get('http://localhost:3000/openapi.yaml', res => { let d=''; res.on('data', c => d+=c); \
  res.on('end', () => console.log(Object.keys(yaml.load(d).paths).length)); });"
# Expect: the same distinct-path count as above (73)

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
# Expect: 99

curl -s http://localhost:3000/api/v1/routes | jq '.data[] | select(.path == "/admin/reset")'
# Expect: {"method":"POST","path":"/admin/reset","description":"...","auth":{"type":"adminToken"}}

# Cross-check against the OpenAPI document directly (filter to real HTTP methods only — a path
# item's shared `parameters` key is not an operation and must be excluded, or this diff will show
# spurious "PARAMETERS" entries on the openapi.json side).
diff \
  <(curl -s http://localhost:3000/api/v1/routes | jq -S '[.data[] | {method,path}] | sort_by(.method,.path)') \
  <(curl -s http://localhost:3000/openapi.json | jq -S '[.paths | to_entries[] | .key as $p | (.value | keys[] | select(IN("get","post","put","patch","delete"))) as $m | {method: ($m|ascii_upcase), path: $p}] | sort_by(.method,.path)')
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
