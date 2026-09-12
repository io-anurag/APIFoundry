import type { Request, Response } from "express";
import * as apiKeyService from "../services/apiKey.service";

/**
 * Handles `POST /auth/api-key`: issues a new API key from the request body via
 * `apiKeyService.issueApiKey` and returns it as `201 Created`.
 * @param req - Express request; body carries the key issuance options.
 * @param res - Express response.
 */
export function issueApiKey(req: Request, res: Response): void {
  res.status(201).json(apiKeyService.issueApiKey(req.body));
}

/**
 * Handles `GET /api-key/protected`: reachable only after the `apiKeyAuth` middleware has already
 * validated the `X-API-Key` header and populated `req.apiKey`, so `granted` is always true here.
 * Responds `200` with the granted flag and the authenticated key's id/label.
 * @param req - Express request; expects `req.apiKey` set by `apiKeyAuth`.
 * @param res - Express response.
 */
export function getApiKeyProtected(req: Request, res: Response): void {
  res.status(200).json({ granted: true, keyId: req.apiKey!.keyId, label: req.apiKey!.label });
}

/**
 * Handles `POST /auth/api-key/revoke`: revokes the key identified by the `X-API-Key` header via
 * `apiKeyService.revokeApiKey`, then responds `200` with an empty body regardless of whether the
 * key existed.
 * @param req - Express request; reads the `X-API-Key` header.
 * @param res - Express response.
 */
export function revokeApiKey(req: Request, res: Response): void {
  apiKeyService.revokeApiKey(req.header("X-API-Key") ?? undefined);
  res.status(200).json({});
}
