# Quickstart: Automated Test Hardening, k6 Scenarios & README

Manual/automatable validation scenarios proving this feature works end-to-end. Assumes the server
is running locally (`npm run dev` or `npm start`) on `http://localhost:3000` with default `.env`
values, and that k6 is installed separately (`k6` on `PATH`) — see
[k6.io/docs/get-started/installation](https://k6.io/docs/get-started/installation/).

## Prerequisites

- `npm install` completed (pulls in `@vitest/coverage-v8` once added by this feature)
- k6 CLI installed, for User Story 2 only
- Server running (`npm run dev`) for User Story 2's and User Story 3's scenarios

## Scenario 1 — Trust the whole surface via one automated test run (User Story 1, P1)

```bash
npm test
# Expect: exit code 0, every one of the (audited) tests/*.test.ts files passing

npm test
# Run again immediately with no manual reset step in between.
# Expect: identical pass/fail result to the previous run (FR-005/SC-002) — no test's outcome
# depends on leftover state or wall-clock time.

npm run test:coverage
# Expect: exit code 0, a printed statement-coverage percentage >= 85% (FR-003); a non-zero exit
# and a reported percentage below 85% is a real gap, not a flaky result.
```

To confirm the suite actually detects regressions (Acceptance Scenario 4), temporarily comment out
one validation check (e.g. the required-field check in `src/services/user.service.ts`) and re-run
`npm test` — expect at least one test in `tests/users.test.ts` to fail; then revert the change.

**Expected outcome (SC-001, SC-002)**: `npm test` is green and reproducible on repeat runs;
`npm run test:coverage` reports >= 85% statement coverage; the checklist-inventory audit
(`data-model.md`'s Coverage inventory table, verified item-by-item in `/speckit-tasks`) accounts
for every CLAUDE.md Testing Expectations category.

## Scenario 2 — Exercise realistic load and chained workflows with k6 (User Story 2, P2)

```bash
BASE_URL=http://localhost:3000 k6 run k6/smoke.js
# Expect: completes in ~30s, all checks pass (near-100%), no threshold breach.

BASE_URL=http://localhost:3000 k6 run k6/load.js
# Expect: ~2 minutes at 20 steady VUs; p95 request duration < 500ms and error rate < 1% on the
# script's targeted (lightweight) endpoints.

BASE_URL=http://localhost:3000 k6 run k6/chained-workflow.js
# Expect: each VU logs in as demo.admin, calls /auth/me with the returned token, lists users,
# fetches one user by an ID taken from that list response, updates that user, creates an order,
# fetches the created order by its returned ID, and deletes a user — every step's checks passing
# and every step's input drawn from the previous step's actual response body (FR-008).

BASE_URL=http://localhost:3000 k6 run k6/error-rate.js
# Expect: a documented mix of non-2xx statuses from /flaky and /errors/*, not all-success and not
# an assertion on any single call's exact outcome (research.md Decision 3).
```

Repeat for `k6/stress.js`, `k6/spike.js`, `k6/soak.js`, `k6/latency.js`, `k6/timeout.js`,
`k6/auth.js`, `k6/crud.js`, and `k6/concurrent-user.js` — each documents its own VU/duration profile
inline (see `data-model.md`'s K6ScenarioScript table for the full default matrix) and is
independently runnable the same way.

**Expected outcome (SC-003)**: every one of the 12 scenario categories named in CLAUDE.md's k6/
workflow orientation section completes against a live server with its category-appropriate pass
rate, and the chained-workflow script demonstrably carries real response data from one step into
the next rather than using hardcoded IDs.

## Scenario 3 — Get a new user from zero to a running, understood server (User Story 3, P3)

Starting from a clean clone, follow only `README.md`:

```bash
cp .env.example .env
npm install
npm run dev
```

Then, still following only the README's new `## Examples` section, run its curl examples verbatim
— at least one success case and one error case per major feature area:

```bash
curl -s http://localhost:3000/api/v1/users?page=1&limit=5 | jq '.pagination'
curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"demo.admin","password":"admin-pass-1"}' | jq '.accessToken'
curl -s http://localhost:3000/api/v1/status/404
curl -s "http://localhost:3000/delay/100"
curl -s -H "X-Admin-Token: admin-secret" -X POST http://localhost:3000/admin/reset | jq
```

**Expected outcome (SC-004, SC-005)**: every step above succeeds exactly as the README describes,
with no undocumented prerequisite; a reader following only the README reaches a running, documented
server in under 10 minutes.

## Final quality gate (FR-015, SC-006)

```bash
npm install
npm run dev &     # confirm no startup errors, then stop it
npm run test:coverage
# Then spot-check:
curl -s http://localhost:3000/docs -o /dev/null -w '%{http_code}\n'
curl -s http://localhost:3000/openapi.json | jq '.info.title'
curl -s http://localhost:3000/openapi.yaml | head -5
curl -s http://localhost:3000/api/v1/routes | jq '.data | length'
```

**Expected outcome**: install succeeds, the server starts cleanly, `npm run test:coverage` passes
(suite green + coverage >= 85%), and all four discovery surfaces respond consistently with the
live route table — the same sequence CLAUDE.md's Testing Expectations require before any
implementation work is considered done.
