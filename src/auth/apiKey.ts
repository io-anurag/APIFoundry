import { randomBytes } from "node:crypto";
import type { ApiKey, ApiKeyStatus } from "../models/apiKey";

/** 256 bits of entropy, hex-encoded to stay header-safe with no encoding edge cases (research.md Decision 2). */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Computed, never stored — `kind: "valid"` keys have `expiresAt: null` so the wall-clock branch
 * only ever fires for a `kind: "expired"` key, whose `expiresAt` is already in the past at
 * issuance, keeping this deterministic on every call (data-model.md, constitution Principle II).
 */
export function computeStatus(key: ApiKey): ApiKeyStatus {
  if (key.revoked) return "revoked";
  if (key.expiresAt !== null && Date.parse(key.expiresAt) <= Date.now()) return "expired";
  return "active";
}
