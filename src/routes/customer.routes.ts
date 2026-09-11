import { Router } from "express";
import * as customerController from "../controllers/customer.controller";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";

// strict: true so a trailing slash does not alias the collection route (FR-006 edge case).
export const customerRouter = Router({ strict: true });

customerRouter.get("/customers", customerController.listCustomers);
customerRouter.post("/customers", customerController.createCustomer);
customerRouter.all("/customers", methodNotAllowedHandler);

customerRouter.get("/customers/:id", customerController.getCustomerById);
customerRouter.put("/customers/:id", customerController.replaceCustomer);
customerRouter.patch("/customers/:id", customerController.patchCustomer);
customerRouter.delete("/customers/:id", customerController.deleteCustomer);
customerRouter.all("/customers/:id", methodNotAllowedHandler);
