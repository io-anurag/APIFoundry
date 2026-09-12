import { randomUUID } from "node:crypto";
import { apiKeyStore } from "../data/apiKey.store";
import { apiKeyIssueRequestSchema } from "../models/apiKeyRequests";
import type { ApiKey } from "../models/apiKey";
import { computeStatus, generateApiKey } from "../auth/apiKey";
import { HttpError } from "../utils/httpError";

/** Already elapsed by the time it's returned — deterministically already-expired, forever (research.md Decision 3). */
const EXPIRED_OFFSET_MS = -10_000;

export interface ApiKeyIssueResult {
  apiKey: string;
  keyId: string;
  label: string | null;
  status: ReturnType<typeof computeStatus>;
  issuedAt: string;
  expiresAt: string | null;
}

/**
 * Issues a new API key for a chosen `kind` (FR-001). Implements the full valid/expired/revoked
 * switch here, once — User Story 3 only adds test coverage for the expired/revoked branches,
 * per research.md Decision 3.
 *
 * @param rawBody - Request body with an optional `label` and `kind` ("valid" | "expired" | "revoked"), validated against `apiKeyIssueRequestSchema`.
 * @returns The issued key's plaintext value, key id, label, computed status, and issued/expiry timestamps.
 */
export function issueApiKey(rawBody: unknown): ApiKeyIssueResult {
  const { label, kind = "valid" } = apiKeyIssueRequestSchema.parse(rawBody ?? {});

  const base = {
    id: generateApiKey(),
    keyId: randomUUID(),
    label: label ?? null,
    issuedAt: new Date().toISOString(),
  };

  let record: ApiKey;
  switch (kind) {
    case "expired":
      record = { ...base, revoked: false, expiresAt: new Date(Date.now() + EXPIRED_OFFSET_MS).toISOString() };
      break;
    case "revoked":
      record = { ...base, revoked: true, expiresAt: null };
      break;
    case "valid":
      record = { ...base, revoked: false, expiresAt: null };
      break;
  }

  apiKeyStore.create(record);

  return {
    apiKey: record.id,
    keyId: record.keyId,
    label: record.label,
    status: computeStatus(record),
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
  };
}

/**
 * Revokes a key presented via `X-API-Key` (FR-002). Idempotent for an already-revoked key; a
 * missing header is `401` (consistent with the protected endpoint) rather than a false `404`.
 *
 * @param rawKey - The API key value from the `X-API-Key` header, or undefined if the header was absent.
 * @returns Nothing; the matching key record is marked revoked as a side effect.
 * @throws HttpError 401 UNAUTHORIZED if `rawKey` is missing.
 * @throws HttpError 404 RESOURCE_NOT_FOUND if no key record matches `rawKey`.
 */
export function revokeApiKey(rawKey: string | undefined): void {
  if (!rawKey) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing X-API-Key header");
  }

  const record = apiKeyStore.get(rawKey);
  if (!record) {
    throw new HttpError(404, "RESOURCE_NOT_FOUND", "API key not found");
  }

  apiKeyStore.replace(rawKey, (existing) => ({ ...existing, revoked: true }));
}
