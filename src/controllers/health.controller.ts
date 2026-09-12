import type { Request, Response } from "express";
import { getLivenessStatus, getReadinessStatus, isReady } from "../services/health.service";

/**
 * Handles `GET /health`: responds `200` with the liveness status from `getLivenessStatus`
 * (the general top-level health-check alias for `/health/live`).
 * @param _req - Express request (unused).
 * @param res - Express response.
 */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json(getLivenessStatus());
}

/**
 * Handles `GET /health/live`: responds `200` with the liveness status from `getLivenessStatus`.
 * @param _req - Express request (unused).
 * @param res - Express response.
 */
export function getLiveness(_req: Request, res: Response): void {
  res.status(200).json(getLivenessStatus());
}

/**
 * Handles `GET /health/ready`: computes the readiness status via `getReadinessStatus` and
 * responds `200` when `isReady()` is true, or `503` otherwise, with the status body either way.
 * @param _req - Express request (unused).
 * @param res - Express response.
 */
export function getReadiness(_req: Request, res: Response): void {
  const status = getReadinessStatus();
  res.status(isReady() ? 200 : 503).json(status);
}
