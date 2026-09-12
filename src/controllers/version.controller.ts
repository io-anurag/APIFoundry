import type { Request, Response } from "express";
import { config } from "../config";
import type { VersionInfo } from "../models/versionInfo";
import packageJson from "../../package.json";

/**
 * Handles `GET /version`: assembles the package version (from `package.json`) and current
 * `NODE_ENV` (from `config`) and responds `200` with it.
 * @param _req - Express request (unused).
 * @param res - Express response.
 */
export function getVersion(_req: Request, res: Response): void {
  const body: VersionInfo = {
    version: packageJson.version,
    nodeEnv: config.nodeEnv,
  };
  res.status(200).json(body);
}
