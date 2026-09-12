/**
 * Parses a raw `Cookie` request header into a plain name/value map. Hand-rolled rather than
 * pulling in the `cookie-parser` package, mirroring `parseBasicAuthHeader`'s (Spec 006)
 * precedent of small, single-purpose header parsers (research.md Decision 6). Never throws — a
 * missing header simply yields `{}`.
 *
 * @param header - The raw `Cookie` header value, if present.
 * @returns A plain object mapping each cookie name to its decoded value.
 */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (typeof header !== "string" || header.length === 0) return {};

  const cookies: Record<string, string> = {};
  for (const pair of header.split("; ")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1);
    if (name.length === 0) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}
