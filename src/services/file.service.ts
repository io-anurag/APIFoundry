import { randomUUID } from "node:crypto";
import { fileStore, nextFileSequence } from "../data/files.store";
import type { FileRecord, FileMetadata } from "../models/file";
import { HttpError } from "../utils/httpError";
import { config } from "../config";
import { parseListQuery } from "../models/listQuery";
import { applyListQuery, type ListQueryResult } from "./listQuery.service";

/**
 * Projects a stored `FileRecord` into its caller-facing `FileMetadata` shape, stripping the raw
 * `content` buffer and the internal `sequence` ordering aid — neither is ever part of the
 * documented response contract (FR-010).
 * @param record - The internal file record to project.
 * @returns The metadata-only projection safe to serialize in any response.
 */
export function toFileMetadata(record: FileRecord): FileMetadata {
  return {
    id: record.id,
    filename: record.filename,
    contentType: record.contentType,
    size: record.size,
    uploadedAt: record.uploadedAt,
  };
}

/**
 * Stores one uploaded file, rejecting the upload if the store is already at its configured
 * maximum count (FR-004). Never evicts an existing file to make room.
 * @param file - The parsed multipart file part (`req.file` from multer's memory storage).
 * @returns The newly stored file's metadata.
 * @throws HttpError 409 STORAGE_LIMIT_EXCEEDED if the store is already at `config.maxStoredFiles`.
 */
export function uploadFile(file: { buffer: Buffer; originalname: string; mimetype: string }): FileMetadata {
  if (fileStore.list().length >= config.maxStoredFiles) {
    throw new HttpError(
      409,
      "STORAGE_LIMIT_EXCEEDED",
      `Maximum stored file count (${config.maxStoredFiles}) reached; delete a file before uploading another.`
    );
  }

  const record: FileRecord = {
    id: randomUUID(),
    filename: file.originalname,
    contentType: file.mimetype || "application/octet-stream",
    size: file.buffer.length,
    uploadedAt: new Date().toISOString(),
    sequence: nextFileSequence(),
    content: file.buffer,
  };

  fileStore.create(record);
  return toFileMetadata(record);
}

/**
 * Looks up a single file's full internal record (including its raw content) by id.
 * @param id - The file id to look up.
 * @returns The matching file record.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no file has that id (never uploaded, or since deleted).
 */
export function getFileRecordById(id: string): FileRecord {
  const record = fileStore.get(id);
  if (!record) throw new HttpError(404, "RESOURCE_NOT_FOUND", `File ${id} not found.`);
  return record;
}

/**
 * Lists every stored file's metadata, paginated, ordered newest-first by upload sequence
 * (research.md Decision 4). No caller-facing `sort` field is supported — any `?sort=` value is
 * rejected with the same `400` shape every other resource uses for an unrecognized sort field
 * (research.md Decision 5).
 *
 * @param rawQuery - Raw query-string parameters (page, limit).
 * @returns The matching page of file metadata plus the total count, page, and limit used.
 */
export function listFiles(
  rawQuery: Record<string, unknown>
): ListQueryResult<FileMetadata> & { page: number; limit: number } {
  const query = parseListQuery(rawQuery, { allowedSortFields: [] });
  const sorted = [...fileStore.list()].sort((a, b) => b.sequence - a.sequence);
  const { data, total } = applyListQuery(sorted, query);
  return { data: data.map(toFileMetadata), total, page: query.page, limit: query.limit };
}

/**
 * Deletes a single file by id.
 * @param id - The file id to delete.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no file has that id, including a repeated delete of
 *   an already-removed id.
 */
export function deleteFileById(id: string): void {
  const removed = fileStore.remove(id);
  if (!removed) throw new HttpError(404, "RESOURCE_NOT_FOUND", `File ${id} not found.`);
}
