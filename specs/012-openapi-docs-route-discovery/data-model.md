# Phase 1 Data Model: OpenAPI, Swagger UI & Route Discovery

This feature introduces **no persisted store**. Every entity below is a static, in-memory
constant (the route catalog) or a response shape derived from it — nothing here is created, read
as a resource, or mutated at runtime, and `POST /admin/reset` (Spec 011) has nothing new to reset
because of this feature.

## RouteInfo (catalog entry / response item)

```ts
export interface RouteInfo {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;        // e.g. "/api/v1/users/{id}" — brace notation, matching openapi.yaml
  description: string; // short, human-readable summary of what the route does
  auth: AuthRequirement;
}
```

- `path` uses the same `{param}` brace notation as `openapi.yaml`'s path keys (not Express's
  `:param` colon notation), so a route table entry can be string-compared directly against the
  parsed OpenAPI document without a conversion step at read time. The conversion from Express's
  internal `:param` form happens once, inside the parity test's live-route introspection helper,
  not in the catalog itself.
- One entry exists per method+path combination — a path with four verbs (e.g.
  `/api/v1/users/{id}` supporting `GET`/`PUT`/`PATCH`/`DELETE`) contributes four separate
  `RouteInfo` entries, matching how `GET /api/v1/routes` (Spec's User Story 3) and
  `openapi.yaml`'s per-operation documentation (User Story 1) both already treat each verb as
  independently documented.

## AuthRequirement (embedded in RouteInfo, and as its own OpenAPI schema)

```ts
export interface AuthRequirement {
  type: "none" | "jwt" | "apiKey" | "basic" | "adminToken";
  detail?: string; // e.g. "role: admin", "scope: orders:write", or a note for dynamic-role routes
}
```

- Flat object, no nested union — see research.md Decision 2. `detail` is present only when a
  route requires more than "any successfully authenticated caller" under its `type` (a specific
  role, a specific scope, or — for `GET /api/v1/role/{role}` and `GET /api/v1/scope/{scope}` — a
  note that the requirement is determined by the path parameter itself).
- `type: "none"` covers every unauthenticated route, including this feature's own four discovery
  endpoints (FR-004).

## RoutesListResponse (the `GET /api/v1/routes` response body)

```ts
export interface RoutesListResponse {
  data: RouteInfo[];
}
```

- Deliberately not the project's pagination envelope — see research.md Decision 3. `data.length`
  equals the total number of implemented method+path combinations (99 once this feature ships: 96
  operations across Specs 001-011, plus `GET /openapi.json`/`GET /openapi.yaml` themselves — found
  undocumented during implementation and documented as part of this feature — plus this endpoint's
  own `GET /api/v1/routes` entry).

## Source-of-truth relationship (how the three discovery surfaces stay provably in sync)

```text
routeRegistry.catalog.ts  <──cross-checked by──  tests/routeParity.test.ts  ──cross-checked by──>  openapi.yaml (paths:)
        │                                                                                                  │
        └────────────────────────────> served as-is by <────────────────────────────────────────────────┘
                                        GET /api/v1/routes           GET /openapi.json, /openapi.yaml, /docs
```

Both `routeRegistry.catalog.ts` and `openapi.yaml`'s `paths` section are independently
cross-checked against the live Express app's actual registered routes (the ground truth) by the
same test, rather than checked against each other directly — this is what lets the test name
exactly which side (the catalog, or the OpenAPI document) is missing or has an extra entry when
it fails, instead of just reporting "the two disagree."

## Coverage inventory (audit basis for the catalog's completeness)

| Spec | Routers already mounted in `src/app.ts` | Operations contributed (existing) |
|---|---|---|
| 001 | `healthRouter`, `versionRouter`, `infoRouter` | 5 |
| 002 | `userRouter`, `productRouter`, `customerRouter`, `orderRouter` | 20 |
| 003 | `categoryRouter`, `postRouter`, `commentRouter`, `reviewRouter`, `paymentRouter`, `searchRouter`, plus nested routes on 002's routers | 19 |
| 004 | `statusCodeRouter` | 1 (parameterized over the documented code list) |
| 005 | `authRouter`, `protectedRouter`, `roleRouter` | 8 |
| 006 | `apiKeyRouter`, `basicAuthRouter` | 4 |
| 007 | `delayRouter`, `payloadRouter`, `contentRouter`, `headersRouter`, `cookiesRouter` | 8 |
| 008 | `rateLimitRouter`, `flakyRouter`, `cacheRouter`, (`paymentRouter` idempotency) | 3 |
| 009 | `filesRouter` | 4 |
| 010 | `errorsRouter`, `testScenarioRouter`, `scopeRouter` | 11 |
| 011 | `adminRouter` | 2 |
| **012 (this feature)** | `openapiRouter` (existing, newly documented), `routesRouter` (new) | **3** (`GET /openapi.json`, `GET /openapi.yaml` documented for the first time; `GET /api/v1/routes` newly built) |

Totals reconcile to the 96 operations `openapi.yaml` documented before this feature (verified by
counting operation entries directly) plus the 2 pre-existing `/openapi.json`/`/openapi.yaml` routes
this feature documents for the first time, plus this feature's own new endpoint, for **99** total —
the number `tests/routeParity.test.ts` and the Success Criteria (SC-001, SC-004) check against.
