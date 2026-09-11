import type { Request, Response } from "express";
import { config } from "../config";
import type { ApiInfo } from "../models/apiInfo";
import packageJson from "../../package.json";

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
