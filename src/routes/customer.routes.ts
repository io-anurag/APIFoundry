/**
 * Customer routes: full CRUD (`GET` list/one, `POST`, `PUT`, `PATCH`, `DELETE`), gated by
 * bearer-token auth — reads require the `customers:read` scope, writes require `customers:write`
 * (either satisfied by `admin`). `Router({ strict: true })` so a trailing slash does not alias the
 * collection route (FR-006 edge case).
 */
import { Router } from "express";
import * as customerController from "../controllers/customer.controller";
import { authenticate } from "../middleware/authenticate";
import { requireScope } from "../middleware/requireScope";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash does not alias the collection route (FR-006 edge case).
export const customerRouter = Router({ strict: true });

customerRouter.get("/customers", authenticate, requireScope("customers:read"), customerController.listCustomers);
customerRouter.post("/customers", authenticate, requireScope("customers:write"), customerController.createCustomer);
customerRouter.all("/customers", methodNotAllowedHandler);

customerRouter.get("/customers/:id", authenticate, requireScope("customers:read"), customerController.getCustomerById);
customerRouter.put("/customers/:id", authenticate, requireScope("customers:write"), customerController.replaceCustomer);
customerRouter.patch("/customers/:id", authenticate, requireScope("customers:write"), customerController.patchCustomer);
customerRouter.delete("/customers/:id", authenticate, requireScope("customers:write"), customerController.deleteCustomer);
customerRouter.all("/customers/:id", methodNotAllowedHandler);
