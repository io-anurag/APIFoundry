import type { Request, Response } from "express";
import { extractBearerToken } from "../middleware/authenticate";
import { HttpError } from "../utils/httpError";
import * as authService from "../services/auth.service";

/**
 * Handles `POST /auth/login`: authenticates credentials from the request body via
 * `authService.login` and responds `200` with the issued access/refresh tokens.
 * @param req - Express request; body carries username/password credentials.
 * @param res - Express response.
 */
export function login(req: Request, res: Response): void {
  res.status(200).json(authService.login(req.body));
}

/**
 * Handles `POST /auth/logout`: extracts the bearer token from the `Authorization` header and
 * revokes its session via `authService.logout`, responding `200` with an empty body.
 * Deliberately NOT gated by the `authenticate` middleware (research.md Decision 5): logout must
 * still succeed (idempotently) for a token whose session was already revoked by a prior logout,
 * which `authenticate` would otherwise reject outright. Throws a `401 UNAUTHORIZED` `HttpError`
 * if the header is missing or malformed.
 * @param req - Express request; reads the `Authorization: Bearer <token>` header.
 * @param res - Express response.
 */
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

/**
 * Handles `POST /auth/refresh`: exchanges the refresh token in the request body for a new token
 * pair via `authService.refresh` and responds `200` with the result.
 * @param req - Express request; body carries the refresh token.
 * @param res - Express response.
 */
export function refresh(req: Request, res: Response): void {
  res.status(200).json(authService.refresh(req.body));
}

/**
 * Handles `GET /auth/me`: returns the profile for the currently authenticated principal via
 * `authService.getMe`, responding `200` with the result. Requires the `authenticate` middleware
 * to have already populated `req.auth`.
 * @param req - Express request; expects `req.auth` set by `authenticate`.
 * @param res - Express response.
 */
export function getMe(req: Request, res: Response): void {
  res.status(200).json(authService.getMe(req.auth!));
}

/**
 * Handles `POST /auth/token`: issues a convenience token (e.g. a pre-canned valid/expired/
 * invalid/revoked token for testing) per the request body via `authService.issueConvenienceToken`,
 * responding `200` with the issued token.
 * @param req - Express request; body selects the convenience token variant/claims.
 * @param res - Express response.
 */
export function issueToken(req: Request, res: Response): void {
  res.status(200).json(authService.issueConvenienceToken(req.body));
}

/**
 * Handles `GET /auth/token-info`: extracts the bearer token from the `Authorization` header and
 * returns its decoded claims/validity via `authService.getTokenInfo`, responding `200` with the
 * result. Throws a `400 VALIDATION_ERROR` `HttpError` if the token is missing or malformed.
 * @param req - Express request; reads the `Authorization: Bearer <token>` header.
 * @param res - Express response.
 */
export function getTokenInfo(req: Request, res: Response): void {
  const token = extractBearerToken(req);
  if (!token) {
    throw new HttpError(400, "VALIDATION_ERROR", "Malformed token");
  }
  res.status(200).json(authService.getTokenInfo(token));
}
