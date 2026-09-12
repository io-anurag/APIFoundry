import type { Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { parseUuidParam } from "../utils/uuidParam";
import { buildContentDisposition } from "../utils/contentDisposition";
import { buildPaginationEnvelope } from "../models/paginationEnvelope";
import * as fileService from "../services/file.service";

/**
 * Handles `POST /files`: requires a single file under the multipart field name `upload` (parsed
 * by `multer` upstream in the route), storing it and responding `201` with its metadata.
 * @param req - Express request; `req.file` is populated by the `upload.single("upload")`
 *   middleware mounted ahead of this handler.
 * @param res - Express response.
 * @throws HttpError 400 VALIDATION_ERROR if `req.file` is absent (non-multipart body, or the
 *   `upload` field was missing/misnamed).
 */
export function postFile(req: Request, res: Response): void {
  if (!req.file) {
    throw new HttpError(400, "VALIDATION_ERROR", "The 'upload' file field is required.");
  }

  res.status(201).json(fileService.uploadFile(req.file));
}

/**
 * Handles `GET /files/:id`: parses the `id` path param via `parseUuidParam` and looks up the
 * file via `fileService.getFileRecordById`, responding `200` with the exact original bytes, the
 * stored content type, and a safely-encoded `Content-Disposition` naming the original filename.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function getFileById(req: Request, res: Response): void {
  const id = parseUuidParam(req.params.id, "file");
  const record = fileService.getFileRecordById(id);

  res
    .status(200)
    .set("Content-Disposition", buildContentDisposition(record.filename))
    .type(record.contentType)
    .send(record.content);
}

/**
 * Handles `GET /files`: lists every stored file's metadata via `fileService.listFiles`, applying
 * the `page`/`limit` pagination options in the query string, and responds `200` with a paginated
 * envelope built by `buildPaginationEnvelope`.
 * @param req - Express request; reads pagination options from `req.query`.
 * @param res - Express response.
 */
export function getFiles(req: Request, res: Response): void {
  const { data, page, limit, total } = fileService.listFiles(req.query as unknown as Record<string, unknown>);
  res.status(200).json(buildPaginationEnvelope(data, page, limit, total));
}

/**
 * Handles `DELETE /files/:id`: parses the `id` path param via `parseUuidParam` and removes the
 * file via `fileService.deleteFileById`, responding `204` on success.
 * @param req - Express request; reads the `id` path parameter.
 * @param res - Express response.
 */
export function deleteFileById(req: Request, res: Response): void {
  const id = parseUuidParam(req.params.id, "file");
  fileService.deleteFileById(id);
  res.status(204).end();
}
