/**
 * `id` holds the same value as a token's `sid` claim — named `id` specifically so this type
 * satisfies `KeyedStore<T extends { id: string }>` and can reuse `createKeyedStore` unchanged
 * (research.md Decision 3).
 */
export interface Session {
  id: string;
  sub: string;
  revoked: boolean;
  currentRefreshJti: string | null;
}
