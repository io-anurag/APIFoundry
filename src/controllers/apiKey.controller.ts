import type { Request, Response } from "express";
import * as apiKeyService from "../services/apiKey.service";

export function issueApiKey(req: Request, res: Response): void {
  res.status(201).json(apiKeyService.issueApiKey(req.body));
}

export function getApiKeyProtected(req: Request, res: Response): void {
  res.status(200).json({ granted: true, keyId: req.apiKey!.keyId, label: req.apiKey!.label });
}

export function revokeApiKey(req: Request, res: Response): void {
  apiKeyService.revokeApiKey(req.header("X-API-Key") ?? undefined);
  res.status(200).json({});
}
