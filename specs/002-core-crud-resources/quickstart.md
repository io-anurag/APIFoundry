# Quickstart: Core CRUD Resources

**Feature**: `002-core-crud-resources`

Validates full CRUD on the four core resources end-to-end: seed data volume, path-parameter edge cases,
validation rejection, and pagination/sorting/filtering. Schemas are defined in
[data-model.md](data-model.md); endpoint contracts in
[contracts/core-crud-resources.openapi.yaml](contracts/core-crud-resources.openapi.yaml).

## Prerequisites

- Node.js 20.x
- Spec 001 (Foundation, Config & Health) implemented and passing

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
curl -s http://localhost:3000/api/v1/users?limit=1 | jq .pagination.total      # expect >= 50
curl -s http://localhost:3000/api/v1/products?limit=1 | jq .pagination.total   # expect >= 50
curl -s http://localhost:3000/api/v1/orders?limit=1 | jq .pagination.total     # expect >= 100
curl -s http://localhost:3000/api/v1/customers?limit=1 | jq .pagination.total  # expect >= number of orders' distinct customers
```

## Validate — full CRUD lifecycle (User Story 1)

```bash
# Create
curl -s -i -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Widget","price":9.99,"category":"electronics","stock":10}'
# Expect: 201, body includes a server-assigned "id"

# Read (replace 51 with the id from the previous response)
curl -s -i http://localhost:3000/api/v1/products/51
# Expect: 200

# Full replace
curl -s -i -X PUT http://localhost:3000/api/v1/products/51 \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Widget v2","price":12.99,"category":"electronics","stock":5}'
# Expect: 200, all fields replaced

# Partial update
curl -s -i -X PATCH http://localhost:3000/api/v1/products/51 \
  -H "Content-Type: application/json" \
  -d '{"stock":3}'
# Expect: 200, only "stock" changed

# Delete
curl -s -i -X DELETE http://localhost:3000/api/v1/products/51
# Expect: 204

# Confirm gone
curl -s -i http://localhost:3000/api/v1/products/51
# Expect: 404, standard error envelope
```

Repeat the same sequence for `/api/v1/users`, `/api/v1/customers`, and `/api/v1/orders` (an order's
create body needs a valid `customerId` and at least one `items[].productId` from seed data, e.g.
`{"customerId":1,"items":[{"productId":1,"quantity":2}]}`).

## Validate — validation rejection (User Story 2)

```bash
# Missing required field
curl -s -i -X POST http://localhost:3000/api/v1/users -H "Content-Type: application/json" -d '{}'
# Expect: 400/422, structured error naming the missing field(s)

# Invalid email
curl -s -i -X POST http://localhost:3000/api/v1/users -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"not-an-email","role":"user"}'
# Expect: 400/422

# Invalid enum value
curl -s -i -X POST http://localhost:3000/api/v1/users -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","role":"superuser"}'
# Expect: 400/422, error identifies "role"

# Out-of-bounds number
curl -s -i -X POST http://localhost:3000/api/v1/products -H "Content-Type: application/json" \
  -d '{"name":"Bad","price":-5,"category":"electronics","stock":1}'
# Expect: 400/422

# Unexpected field
curl -s -i -X POST http://localhost:3000/api/v1/users -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","role":"user","notAField":true}'
# Expect: 400, rejected per the unknown-field policy

# Dangling cross-resource reference
curl -s -i -X POST http://localhost:3000/api/v1/orders -H "Content-Type: application/json" \
  -d '{"customerId":999999,"items":[{"productId":1,"quantity":1}]}'
# Expect: 400/422, error identifies "customerId"
```

## Validate — path parameter edge cases (User Story 3)

```bash
curl -s -i http://localhost:3000/api/v1/users/999999   # valid format, not found -> 404
curl -s -i http://localhost:3000/api/v1/users/abc      # malformed -> 400
curl -s -i http://localhost:3000/api/v1/users/-1       # negative -> 400
curl -s -i http://localhost:3000/api/v1/users/0        # zero -> 400
curl -s -i http://localhost:3000/api/v1/users/99999999999999999999  # huge -> 400
```

None of the above should ever return a `500` or hang the process.

## Validate — pagination, sorting, filtering (User Story 4)

```bash
curl -s "http://localhost:3000/api/v1/products?page=2&limit=10" | jq .pagination
# Expect: page=2, limit=10, accurate total/totalPages/hasNext/hasPrevious

curl -s -i "http://localhost:3000/api/v1/products?page=0"        # invalid page -> 400
curl -s -i "http://localhost:3000/api/v1/products?limit=-5"      # invalid limit -> 400

curl -s "http://localhost:3000/api/v1/products?sort=price" | jq '.data[].price'         # ascending
curl -s "http://localhost:3000/api/v1/products?sort=-price" | jq '.data[].price'        # descending
curl -s -i "http://localhost:3000/api/v1/products?sort=notAField"                        # unknown sort field -> 400

curl -s "http://localhost:3000/api/v1/products?category=electronics" | jq '.data[].category'  # all "electronics"
curl -s "http://localhost:3000/api/v1/orders?status=pending" | jq '.data[].status'            # all "pending"
```

## Automated tests

```bash
npm test
```

Expect coverage of CRUD lifecycle, validation categories (FR-012), path-parameter edge cases, and
pagination/sorting/filtering for all four resources, plus continued passing of the Spec 001 suite.

## Docs surface

```bash
open http://localhost:3000/docs
curl http://localhost:3000/openapi.json
curl http://localhost:3000/openapi.yaml
curl http://localhost:3000/api/v1/routes 2>/dev/null || true  # introduced in a later spec; ignore 404 here
```

Confirm the documented paths for `users`, `products`, `orders`, and `customers` (list/get/create/
replace/patch/delete) match exactly what this spec implements.
