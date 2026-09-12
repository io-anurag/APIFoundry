import { createHash } from "node:crypto";

/**
 * Recursively sorts object keys (arrays map element-wise, primitives pass through unchanged) so
 * that semantically-identical bodies with different key order produce identical output.
 *
 * @param value - The value to canonicalize.
 * @returns A structurally equivalent value with every nested object's keys sorted.
 */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = canonicalize(val);
      return acc;
    }, {});
  }

  return value;
}

/**
 * Hashes a request body for idempotency-conflict detection: canonicalizes it first (so key
 * reordering never produces a false conflict), then SHA-256-hashes the resulting JSON text.
 *
 * @param body - The request body to hash.
 * @returns A hex-encoded SHA-256 digest of the canonicalized body.
 */
export function hashRequestBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(body))).digest("hex");
}
