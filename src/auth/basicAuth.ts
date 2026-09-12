const BASIC_PREFIX = "Basic ";

/**
 * Parses an `Authorization: Basic <base64>` header. Returns `null` on any structural problem
 * (missing header, wrong scheme, invalid base64) rather than throwing (research.md Decision 5) —
 * callers treat `null` as a "malformed" 401, distinct from a well-formed-but-wrong-credential one.
 * Splits on the first `:` only, since a password may itself contain a colon (Edge Cases).
 *
 * @param header - The raw `Authorization` header value, if present.
 * @returns The decoded `{ username, password }` pair, or `null` if the header is missing or malformed.
 */
export function parseBasicAuthHeader(header: string | undefined): { username: string; password: string } | null {
  if (typeof header !== "string" || !header.startsWith(BASIC_PREFIX)) return null;

  const encoded = header.slice(BASIC_PREFIX.length);
  if (encoded.length === 0 || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return null;

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}
