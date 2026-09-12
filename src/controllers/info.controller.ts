import type { Request, Response } from "express";
import { config } from "../config";
import type { ApiInfo } from "../models/apiInfo";
import packageJson from "../../package.json";

/**
 * Handles `GET /api/v1/info`: assembles API metadata (name/version from `package.json`,
 * environment and API prefix from `config`, and process uptime) and responds `200` with it.
 * @param _req - Express request (unused).
 * @param res - Express response.
 */
export function getInfo(_req: Request, res: Response): void {
  const body: ApiInfo = {
    name: packageJson.name,
    version: packageJson.version,
    environment: config.nodeEnv,
    apiPrefix: config.apiPrefix,
    uptimeSeconds: process.uptime(),
  };
  res.status(200).json(body);
}
