import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as userService from "../services/user.service";

/**
 * Handles `GET /users`: lists users via `userService.listUsers`, applying the pagination/sort/
 * filter options in the query string, and responds `200` with a paginated envelope built by
 * `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination/filter options from `req.query`.
 * @param res - Express response.
 */
export function listUsers(req: Request, res: Response): void {
  const { data, page, limit, total } = userService.listUsers(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `GET /users/:id`: parses the `id` path param via `parseIdParam` and looks up the user
 * via `userService.getUser`, responding `200` with the user.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getUserById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  res.status(200).json(userService.getUser(id));
}

/**
 * Handles `POST /users`: creates a new user from the request body via `userService.createUser`,
 * responding `201` with the created user.
 * @param req - Express request; body carries the new user's fields.
 * @param res - Express response.
 */
export function createUser(req: Request, res: Response): void {
  res.status(201).json(userService.createUser(req.body));
}

/**
 * Handles `PUT /users/:id`: parses the `id` path param via `parseIdParam` and fully replaces the
 * user with the request body via `userService.replaceUser`, responding `200` with the replaced
 * user.
 * @param req - Express request; reads the `id` path parameter and the replacement body.
 * @param res - Express response.
 */
export function replaceUser(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  res.status(200).json(userService.replaceUser(id, req.body));
}

/**
 * Handles `PATCH /users/:id`: parses the `id` path param via `parseIdParam` and applies a partial
 * update from the request body via `userService.patchUser`, responding `200` with the updated
 * user.
 * @param req - Express request; reads the `id` path parameter and the partial update body.
 * @param res - Express response.
 */
export function patchUser(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  res.status(200).json(userService.patchUser(id, req.body));
}

/**
 * Handles `DELETE /users/:id`: parses the `id` path param via `parseIdParam`, deletes the user
 * via `userService.deleteUser`, and responds `204` with no body.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function deleteUser(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  userService.deleteUser(id);
  res.status(204).send();
}
