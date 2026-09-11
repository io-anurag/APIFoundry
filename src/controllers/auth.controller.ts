import type { Request, Response } from "express";
import { extractBearerToken } from "../middleware/authenticate";
import { HttpError } from "../utils/httpError";
import * as authService from "../services/auth.service";

export function login(req: Request, res: Response): void {
  res.status(200).json(authService.login(req.body));
}

export function logout(req: Request, res: Response): void {
  // Deliberately NOT gated by the `authenticate` middleware (research.md Decision 5): logout must
  // still succeed (idempotently) for a token whose session was already revoked by a prior logout,
  // which `authenticate` would otherwise reject outright.
  const token = extractBearerToken(req);
  if (!token) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing or malformed Authorization header");
  }
  authService.logout(token);
  res.status(200).json({});
}

export function refresh(req: Request, res: Response): void {
  res.status(200).json(authService.refresh(req.body));
}

export function getMe(req: Request, res: Response): void {
  res.status(200).json(authService.getMe(req.auth!));
}

export function issueToken(req: Request, res: Response): void {
  res.status(200).json(authService.issueConvenienceToken(req.body));
}

export function getTokenInfo(req: Request, res: Response): void {
  const token = extractBearerToken(req);
  if (!token) {
    throw new HttpError(400, "VALIDATION_ERROR", "Malformed token");
  }
  res.status(200).json(authService.getTokenInfo(token));
}
