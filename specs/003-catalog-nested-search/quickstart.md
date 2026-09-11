# Quickstart: Read-Only Catalog & Nested Resources + Search

**Feature**: `003-catalog-nested-search`

Validates the five new read-oriented resources, the six nested/derived routes, path-parameter type
diversity (slug/UUID/date/enum), and cross-resource search. Schemas are defined in
[data-model.md](data-model.md); endpoint contracts in
[contracts/catalog-nested-search.openapi.yaml](contracts/catalog-nested-search.openapi.yaml).

## Prerequisites

- Node.js 20.x
- Specs 001 (Foundation) and 002 (Core CRUD Resources) implemented and passing

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

## Validate — seed data volume (FR-002)

```bash
curl -s http://localhost:3000/api/v1/categories?limit=1 | jq .pagination.total  # expect >= 20
curl -s http://localhost:3000/api/v1/posts?limit=1 | jq .pagination.total      # expect >= 100
curl -s http://localhost:3000/api/v1/comments?limit=1 | jq .pagination.total   # expect >= 200
curl -s http://localhost:3000/api/v1/reviews?limit=1 | jq .pagination.total    # expect >= 100
curl -s http://localhost:3000/api/v1/payments?limit=1 | jq .pagination.total   # expect == orders total
```

## Validate — read-only catalog (User Story 1)

```bash
curl -s -i http://localhost:3000/api/v1/categories/electronics   # 200
curl -s -i http://localhost:3000/api/v1/categories/not-a-slug-that-exists  # 404
curl -s -i "http://localhost:3000/api/v1/categories/Not_A_Slug!"          # 400 (bad slug format)

curl -s -i -X POST http://localhost:3000/api/v1/categories -d '{}'  # 405 (read-only)
curl -s -i -X DELETE http://localhost:3000/api/v1/posts/00000000-0000-4000-8000-000000000000  # 405
```

## Validate — nested parent-child navigation (User Story 2)

```bash
# Orders placed by a user (via customer.userId link)
curl -s "http://localhost:3000/api/v1/users/1/orders" | jq .pagination

# A user's posts, then create a new one
curl -s "http://localhost:3000/api/v1/users/1/posts" | jq '.data | length'
curl -s -i -X POST http://localhost:3000/api/v1/users/1/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","body":"Hello from quickstart"}'
# Expect: 201, body includes a server-assigned UUID "id" and "userId": 1

# Comments on a post (replace <postId> with a seeded or just-created post id)
curl -s "http://localhost:3000/api/v1/posts/<postId>/comments" | jq '.data | length'
curl -s -i -X POST http://localhost:3000/api/v1/posts/<postId>/comments \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"body":"Nice post!"}'
# Expect: 201

# Reviews and category for a product
curl -s "http://localhost:3000/api/v1/products/1/reviews" | jq .pagination
curl -s -i http://localhost:3000/api/v1/products/1/category   # 200, a Category record

# Distinct products on an order
curl -s "http://localhost:3000/api/v1/orders/1/products" | jq .pagination

# Nonexistent parent -> 404 (not an empty list)
curl -s -i http://localhost:3000/api/v1/users/999999/posts     # 404
curl -s -i http://localhost:3000/api/v1/posts/00000000-0000-4000-8000-000000000000/comments  # 404
```

## Validate — path parameter type diversity (User Story 3)

```bash
# Slug (categories)
curl -s -i http://localhost:3000/api/v1/categories/books        # 200
curl -s -i http://localhost:3000/api/v1/categories/nonexistent  # 404
curl -s -i "http://localhost:3000/api/v1/categories/Bad_Slug"   # 400

# UUID (posts, payments)
curl -s -i http://localhost:3000/api/v1/posts/not-a-uuid        # 400
curl -s -i http://localhost:3000/api/v1/posts/00000000-0000-4000-8000-000000000000  # 404 (well-formed, unknown)

# Date (payments/by-date)
curl -s "http://localhost:3000/api/v1/payments/by-date/2026-01-15" | jq .pagination
curl -s -i http://localhost:3000/api/v1/payments/by-date/2026-13-01   # 400 (invalid month)
curl -s -i http://localhost:3000/api/v1/payments/by-date/not-a-date   # 400

# Enum (reviews/by-rating)
curl -s "http://localhost:3000/api/v1/reviews/by-rating/5" | jq '.data[].rating'  # all 5
curl -s -i http://localhost:3000/api/v1/reviews/by-rating/7    # 400 (out of range)
```

## Validate — cross-resource search (User Story 4)

```bash
curl -s "http://localhost:3000/api/v1/search?q=electronics" | jq '.data[].resourceType'
curl -s -i "http://localhost:3000/api/v1/search"          # 400 (missing q)
curl -s -i "http://localhost:3000/api/v1/search?q="       # 400 (empty q)
curl -s "http://localhost:3000/api/v1/search?q=zzzznomatch" | jq .data  # 200, []
curl -s -i "http://localhost:3000/api/v1/search?q=%25%24%23"           # 200, special chars, no crash
curl -s "http://localhost:3000/api/v1/search?q=ELECTRONICS" | jq '.data | length'  # same as lowercase
```

## Automated tests

```bash
npm test
```

Expect coverage of the five new resources' list/get/404/400 behavior, every nested route (including the
parent-not-found vs. empty-children distinction), nested `POST` validation (including the comment
author cross-reference check), path-parameter diversity across slug/UUID/date/enum, and the search edge
case matrix, plus continued passing of the Spec 001/002 suites.

## Docs surface

```bash
open http://localhost:3000/docs
curl http://localhost:3000/openapi.json
curl http://localhost:3000/openapi.yaml
```

Confirm the documented paths for `categories`, `posts`, `comments`, `reviews`, `payments`, every nested
route, and `/api/v1/search` match exactly what this spec implements.
