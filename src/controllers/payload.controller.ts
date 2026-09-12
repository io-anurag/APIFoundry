import type { Request, Response } from "express";
import * as payloadService from "../services/payload.service";

/**
 * Handles `GET /payload/:preset`: returns a generated body sized to the requested preset.
 *
 * @param req - The incoming request; carries the preset via `req.params.preset`.
 * @param res - Used to send the generated `{ size, data }` payload.
 */
export function getPayloadByPreset(req: Request, res: Response): void {
  res.status(200).json(payloadService.getPayloadByPreset(req.params.preset));
}

/**
 * Handles `GET /payload?size=`: returns a generated body of the requested byte size.
 *
 * @param req - The incoming request; carries the size via `req.query.size`.
 * @param res - Used to send the generated `{ size, data }` payload.
 */
export function getPayloadBySize(req: Request, res: Response): void {
  res.status(200).json(payloadService.getPayloadBySize(req.query.size));
}

/**
 * Handles `POST /payload`: reports the exact byte length of the request body received.
 *
 * @param req - The incoming request; carries the raw body bytes via `req.rawBody`.
 * @param res - Used to send the `{ received, contentLength }` response.
 */
export function postPayload(req: Request, res: Response): void {
  res.status(200).json(payloadService.echoPayload(req));
}
