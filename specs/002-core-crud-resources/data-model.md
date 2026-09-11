# Phase 1 Data Model: Core CRUD Resources

**Feature**: `002-core-crud-resources` | **Date**: 2026-09-11

Four in-memory resources, each with its own auto-incrementing numeric `id` store (see
[research.md](research.md)). Enum values and the Customer↔User/Order↔Customer relationships below are
fixed by the Clarifications session recorded in [spec.md](spec.md).

## User

| Field | Type | Notes |
|---|---|---|
| `id` | integer, server-assigned | Immutable; never accepted from a request body |
| `name` | string, 1–200 chars | Required |
| `email` | string, valid email format, unique across users | Required |
| `role` | enum: `user` \| `admin` \| `manager` \| `readonly` | Required; invalid values rejected as `VALIDATION_ERROR` |
| `status` | enum: `active` \| `inactive` | Default `active` |
| `createdAt` | ISO 8601 string, server-assigned | Set on create, never accepted from a request body |
| `updatedAt` | ISO 8601 string, server-assigned | Updated on every `PUT`/`PATCH` |

**Validation rules**: `name` and `email` required and non-empty on create/`PUT`; `email` uniqueness
checked against all other users; `role` and `status` restricted to their enums; unknown fields rejected
(`.strict()`).

## Product

| Field | Type | Notes |
|---|---|---|
| `id` | integer, server-assigned | Immutable |
| `name` | string, 1–200 chars | Required |
| `description` | string, 0–2000 chars | Optional, defaults to `""` |
| `price` | number, > 0 | Required |
| `category` | enum: `electronics` \| `books` \| `clothing` \| `home` \| `toys` \| `grocery` \| `sports` \| `beauty` \| `automotive` \| `other` | Required; a plain string field, **not** a foreign key — independent of the `categories` resource introduced by a later spec |
| `stock` | integer, >= 0 | Required; available quantity |
| `createdAt` | ISO 8601 string, server-assigned | |
| `updatedAt` | ISO 8601 string, server-assigned | |

**Validation rules**: `price > 0`, `stock >= 0`; `category` restricted to the fixed enum above; unknown
fields rejected.

## Customer

| Field | Type | Notes |
|---|---|---|
| `id` | integer, server-assigned | Immutable |
| `name` | string, 1–200 chars | Required |
| `email` | string, valid email format, unique across customers | Required |
| `address` | object: `{ street, city, postalCode, country }` (all strings, required together) | Required |
| `userId` | integer, nullable, optional | When present, MUST reference an existing `User.id`; absence is valid (not every customer has a registered account) |
| `createdAt` | ISO 8601 string, server-assigned | |
| `updatedAt` | ISO 8601 string, server-assigned | |

**Validation rules**: `email` uniqueness checked against all other customers; `address` sub-fields all
required when `address` is supplied; `userId`, if present, validated against the user store and rejected
with a structured validation error if it does not resolve; unknown fields rejected.

## Order

| Field | Type | Notes |
|---|---|---|
| `id` | integer, server-assigned | Immutable |
| `customerId` | integer | Required; MUST reference an existing `Customer.id` — **not** a `userId` directly (Clarifications) |
| `items` | array of `OrderLineItem`, min 1 entry | Required |
| `status` | enum: `pending` \| `processing` \| `shipped` \| `delivered` \| `cancelled` | Required; default `pending` on create |
| `total` | number, >= 0, server-computed | Derived from `items[].quantity * product.price` at write time, not client-supplied |
| `createdAt` | ISO 8601 string, server-assigned | |
| `updatedAt` | ISO 8601 string, server-assigned | |

### OrderLineItem (nested, not independently addressable in this spec)

| Field | Type | Notes |
|---|---|---|
| `productId` | integer | Required; MUST reference an existing `Product.id` |
| `quantity` | integer, >= 1 | Required |

**Validation rules**: `customerId` must resolve to an existing customer; every `items[].productId` must
resolve to an existing product; `items` must contain at least one entry; `status` restricted to the
fixed enum above; `total` is always server-computed and ignored/rejected if supplied by the client;
unknown fields rejected.

## Relationships

- `Customer.userId` (optional) → `User.id`: a customer may optionally link to a registered user account.
  This is the join the future `users/:id/orders` nested route (Spec 003) uses to resolve a user's orders
  (`User` → `Customer` via `userId` → `Order` via `customerId`) without `Order` carrying its own `userId`.
- `Order.customerId` → `Customer.id`: every order belongs to exactly one customer; required, validated on
  write.
- `Order.items[].productId` → `Product.id`: every line item references an existing product; validated on
  write.
- `Product.category` is a plain enumerated string local to this spec, not a foreign key — it has no
  relationship to the `categories` CRUD resource a later spec introduces.

## Shared envelopes (reused, not redefined)

- **List responses** for all four resources use `PaginationEnvelope` exactly as defined in Spec 001
  (`src/models/paginationEnvelope.ts`).
- **All error responses** use `ErrorEnvelope` exactly as defined in Spec 001
  (`src/models/errorEnvelope.ts`), with codes introduced by this spec: `VALIDATION_ERROR`,
  `RESOURCE_NOT_FOUND` (both already defined in principle by Spec 001's error handler;
  `RESOURCE_NOT_FOUND` is reused verbatim for per-resource 404s).
