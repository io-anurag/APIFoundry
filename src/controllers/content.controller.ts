import type { Request, Response } from "express";
import * as contentService from "../services/content.service";

/**
 * Handles `GET /content/:type`: responds with the demo body in the correct `Content-Type` for the
 * requested type (FR-010) — `json` via `res.json`, the others via `res.type(...).send(...)`.
 *
 * @param req - The incoming request; carries the type via `req.params.type`.
 * @param res - Used to send the demo body with the matching `Content-Type` header.
 */
export function getContent(req: Request, res: Response): void {
  const demo = contentService.getContentDemo(req.params.type);
  if (demo.type === "json") {
    res.status(200).json(demo.body);
    return;
  }
  res.status(200).type(demo.mediaType).send(demo.body as string);
}

/**
 * Handles `POST /content/:type`: validates the request's `Content-Type` header against the
 * expected media type for `:type` and confirms acceptance.
 *
 * @param req - The incoming request; its `Content-Type` header is validated.
 * @param res - Used to send the `{ accepted, type }` response.
 */
export function postContent(req: Request, res: Response): void {
  const type = contentService.validateContentType(req, req.params.type);
  res.status(200).json({ accepted: true, type });
}
