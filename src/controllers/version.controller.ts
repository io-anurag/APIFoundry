import type { Request, Response } from "express";
import { config } from "../config";
import type { VersionInfo } from "../models/versionInfo";
import packageJson from "../../package.json";

export function getVersion(_req: Request, res: Response): void {
  const body: VersionInfo = {
    version: packageJson.version,
    nodeEnv: config.nodeEnv,
  };
  res.status(200).json(body);
}
