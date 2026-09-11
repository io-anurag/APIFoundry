import type { Request, Response } from "express";
import { getLivenessStatus, getReadinessStatus, isReady } from "../services/health.service";

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json(getLivenessStatus());
}

export function getLiveness(_req: Request, res: Response): void {
  res.status(200).json(getLivenessStatus());
}

export function getReadiness(_req: Request, res: Response): void {
  const status = getReadinessStatus();
  res.status(isReady() ? 200 : 503).json(status);
}
