import type { Request, Response } from "express";
import { parseIdParam } from "../utils/idParam";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as userService from "../services/user.service";

export function listUsers(req: Request, res: Response): void {
  const { data, page, limit, total } = userService.listUsers(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

export function getUserById(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  res.status(200).json(userService.getUser(id));
}

export function createUser(req: Request, res: Response): void {
  res.status(201).json(userService.createUser(req.body));
}

export function replaceUser(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  res.status(200).json(userService.replaceUser(id, req.body));
}

export function patchUser(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  res.status(200).json(userService.patchUser(id, req.body));
}

export function deleteUser(req: Request, res: Response): void {
  const id = parseIdParam(req.params.id, "user");
  userService.deleteUser(id);
  res.status(204).send();
}
