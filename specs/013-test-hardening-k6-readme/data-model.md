# Phase 1 Data Model: Automated Test Hardening, k6 Scenarios & README

This feature introduces **no persisted or in-memory store** and changes no existing resource
shape. `POST /admin/reset` has nothing new to reset because of this feature. The "entities" below
are documentation/tooling artifacts this feature produces or governs, not API resources.

## TestChecklistItem (the audit unit behind FR-002/SC-001)

```ts
interface TestChecklistItem {
  category: string;       // e.g. "rate limiting", "token expiry/revocation"
  claudeMdRef: string;    // the Testing Expectations sub-bullet this item traces to
  coveringFiles: string[]; // existing tests/*.test.ts file(s) asserting this behavior today
  status: "covered" | "gap"; // set by the /speckit-tasks audit, not assumed here
}
```

- One row per feature-area category named in CLAUDE.md's Testing Expectations paragraph.
- `status` starts `"covered"` only where a named file demonstrably asserts the behavior (per the
  Coverage inventory below); anything not yet verified line-by-line stays `"gap"` until
  `/speckit-tasks` confirms it, per research.md Decision 4 — this document does not pre-declare
  100% coverage.

## CoverageReport (the artifact behind FR-003)

```ts
interface CoverageReport {
  statementsPct: number; // from @vitest/coverage-v8; gate requires >= 85
  branchesPct: number;    // reported, not gated (Session 2026-09-12, Q3 scope)
  functionsPct: number;   // reported, not gated
  linesPct: number;        // reported, not gated
}
```

- Produced by `npm run test:coverage` (`vitest run --coverage`); `statementsPct < 85` fails that
  command's exit code, which is what FR-015's final quality gate and CI check.

## K6ScenarioScript (one per FR-007 category, plus the FR-008 chained-workflow script)

```ts
interface K6ScenarioScript {
  category:
    | "smoke" | "load" | "stress" | "spike" | "soak" | "latency" | "timeout"
    | "error-rate" | "auth" | "crud" | "chained-workflow" | "concurrent-user";
  file: string;             // k6/<category>.js
  vus: number | { start: number; target: number }; // fixed VU count, or a ramp range
  durationSec: number;
  thresholds: { p95Ms?: number; errorRatePct?: number }; // omitted where the category has no
                                                          // numeric pass/fail bar (e.g. error-rate
                                                          // itself expects a documented *mix*, not
                                                          // a low error rate)
}
```

- Concrete default values per category (Session 2026-09-12, Q1/Q2):

  | category | vus | duration | thresholds |
  |---|---|---|---|
  | smoke | 1 | 30s | p95 <500ms, errors <1% |
  | load | 20 | 2m | p95 <500ms, errors <1% |
  | stress | ramp 20→100 | 5m | p95 <500ms, errors <1% |
  | spike | jump to 200 | 30s | errors <1% by end of ramp-down (brief backlog tolerated during the jump) |
  | soak | 20 | 30m | p95 <500ms, errors <1% |
  | concurrent-user | 50 (each running the full chained workflow) | length of one full chained-workflow iteration | every step's own checks pass |
  | latency, timeout | n/a (functional, not load-shaped) | n/a | asserts observed latency/timeout behavior tracks the requested delay/`MAX_DELAY_MS`, not a load threshold |
  | error-rate | n/a | n/a | expects a documented *mix* of non-2xx statuses (Edge Cases), not a low-error-rate pass bar |
  | auth, crud, chained-workflow | n/a | n/a | near-100% pass rate (functional correctness, not load) |

  All VU/duration values are overridable via k6 CLI options (`--vus`, `--duration`) or `__ENV`
  variables read by `k6/lib/config.js`, per FR-007/FR-009.

## ReadmeSection (the artifact behind FR-012–FR-014)

```ts
interface ReadmeSection {
  heading: string;         // e.g. "### Test Hardening, k6 Scenarios & README (Spec 013)"
  specRef: number;         // 1-13
  curlExamples: { description: string; command: string; expected: string }[];
}
```

- New sections for Specs 012 and 013 follow the existing `### ... (Spec NNN)` heading convention
  already used for Specs 001-011 (research.md Decision 5); at least one success-case and one
  error-case `curlExamples` entry per major feature area (CRUD, each auth mechanism, status-code
  playground, delay/payload endpoints, rate limiting, admin reset), per FR-013.

## Coverage inventory (audit basis for TestChecklistItem, per research.md Decision 4)

| CLAUDE.md Testing Expectations category | Existing covering test file(s) |
|---|---|
| CRUD (all four resources) | `users.test.ts`, `products.test.ts`, `orders.test.ts`, `customers.test.ts` |
| All HTTP methods (incl. 405 on unsupported verbs) | `categories.test.ts`, `comments.test.ts`, `payments.test.ts`, `posts.test.ts`, `reviews.test.ts`, `routes.test.ts`, `statusCodes.test.ts`, `admin.test.ts`, `cache.test.ts`, `errorScenarios.test.ts`, `flaky.test.ts`, `rateLimit.test.ts` already assert 405; **gap found by the T005 audit**: `users.test.ts`, `products.test.ts`, `orders.test.ts`, `customers.test.ts` did not — closed by tasks.md T006-T009 |
| Path/query param edge cases | same four, plus `categories.test.ts`, `posts.test.ts`, `comments.test.ts`, `reviews.test.ts`, `search.test.ts` |
| Request validation (400/422) | same four CRUD files, plus `errorEnvelope.test.ts` |
| JWT auth (login/refresh/me/token/token-info) | `auth.test.ts`, `authToken.test.ts`, `protected.test.ts` |
| Token expiry/revocation | `authToken.test.ts` |
| API key auth (incl. expiry/revocation) | `apiKey.test.ts` |
| Basic auth | `basicAuth.test.ts` |
| Roles | `roles.test.ts` |
| Scopes | `scopes.test.ts` |
| Pagination/filtering/sorting | CRUD + catalog test files (list-endpoint assertions) |
| Status codes | `statusCodes.test.ts` |
| Delays | `delay.test.ts` |
| Rate limiting | `rateLimit.test.ts` |
| Flaky/random failures | `flaky.test.ts` |
| ETag/caching | `cache.test.ts` |
| Idempotency | `payments.test.ts`, `paymentsIdempotency.test.ts` |
| Nested resources | `orders.test.ts` (users→orders), `posts.test.ts` (users→posts, posts→comments), `reviews.test.ts` (products→reviews), `categories.test.ts` (products→category) |
| Payload size/echo | `payload.test.ts` |
| Content types | `content.test.ts` |
| Headers | `headers.test.ts` |
| Cookies | `cookies.test.ts` |
| Files | `files.test.ts` |
| Error simulation + generic scenario endpoint | `errorScenarios.test.ts`, `testScenario.test.ts` |
| Admin/reset | `admin.test.ts` |
| OpenAPI/route discovery/parity | `openapiDocs.test.ts`, `openapiSchema.test.ts`, `routes.test.ts`, `routeParity.test.ts` |
| Cross-cutting: request-id, error envelope, CORS, config | `requestId.test.ts`, `errorEnvelope.test.ts`, `cors.test.ts`, `config.test.ts` |

**Audit result (T005, grep-verified against all 42 files)**: every row's `status` is `"covered"`
except "All HTTP methods", which was `"gap"` until tasks.md T006-T009 added the missing 405
assertions to the four core CRUD resource test files — now also `"covered"`. No other gap was
found in this pass.
