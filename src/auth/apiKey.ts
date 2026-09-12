import { randomBytes } from "node:crypto";
import type { ApiKey, ApiKeyStatus } from "../models/apiKey";

/**
 * Generates a new API key. Uses 256 bits of entropy, hex-encoded to stay header-safe with no
 * encoding edge cases (research.md Decision 2).
 *
 * @returns A freshly generated, hex-encoded API key string.
 */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Computes the current status of an API key from its stored fields. Computed, never stored —
 * `kind: "valid"` keys have `expiresAt: null` so the wall-clock branch only ever fires for a
 * `kind: "expired"` key, whose `expiresAt` is already in the past at issuance, keeping this
 * deterministic on every call (data-model.md, constitution Principle II).
 *
 * @param key - The API key record to evaluate.
 * @returns `"revoked"` if the key was revoked, `"expired"` if its expiry has passed, otherwise `"active"`.
 */
export function computeStatus(key: ApiKey): ApiKeyStatus {
  if (key.revoked) return "revoked";
  if (key.expiresAt !== null && Date.parse(key.expiresAt) <= Date.now()) return "expired";
  return "active";
}
