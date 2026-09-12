export const API_KEY_KINDS = ["valid", "expired", "revoked"] as const;
export type ApiKeyKind = (typeof API_KEY_KINDS)[number];

export type ApiKeyStatus = "active" | "expired" | "revoked";

/**
 * `id` holds the raw, opaque key value itself (research.md Decision 1) — named `id` specifically
 * so this type satisfies `KeyedStore<T extends { id: string }>` and can reuse `createKeyedStore`
 * unchanged, mirroring how Spec 005's `Session.id` holds a JWT's `sid` claim. `keyId` is a
 * separate, non-secret identifier shown to callers for correlation/labeling; it is never used for
 * lookup.
 */
export interface ApiKey {
  id: string;
  keyId: string;
  label: string | null;
  revoked: boolean;
  issuedAt: string;
  expiresAt: string | null;
}
