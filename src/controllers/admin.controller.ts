import type { Request, Response } from "express";
import { resetDataStores, resetAuthStores } from "../services/admin.service";
import { requestIdOf } from "../middleware/requestId";
import type { AdminResetResult } from "../models/adminResetResult";

/**
 * Handles `POST /admin/reset` (reachable only after `adminAuth` has validated `X-Admin-Token`):
 * restores every data-plane store to its seeded state via `resetDataStores`, ignoring any request
 * body, and responds `200` with a simple acknowledgment.
 * @param req - Express request; body is never consulted.
 * @param res - Express response.
 */
export function postAdminReset(req: Request, res: Response): void {
  resetDataStores();
  const result: AdminResetResult = {
    message: "Data reset to seed state",
    domain: "data",
    requestId: requestIdOf(req),
  };
  res.status(200).json(result);
}

/**
 * Handles `POST /admin/auth/reset` (reachable only after `adminAuth` has validated
 * `X-Admin-Token`): restores every auth-plane store to its initial state via `resetAuthStores`,
 * ignoring any request body, and responds `200` with a simple acknowledgment.
 * @param req - Express request; body is never consulted.
 * @param res - Express response.
 */
export function postAdminAuthReset(req: Request, res: Response): void {
  resetAuthStores();
  const result: AdminResetResult = {
    message: "Auth state reset to initial configuration",
    domain: "auth",
    requestId: requestIdOf(req),
  };
  res.status(200).json(result);
}
