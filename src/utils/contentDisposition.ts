const CONTROL_CHARACTERS = /[\x00-\x1F\x7F]/g;
const ASCII_UNSAFE = /["\\]/g;

/**
 * Builds a `Content-Disposition: attachment` header value for a caller-supplied filename, safe to
 * pass directly to `res.set(...)`. A filename is fully caller-controlled input flowing into an
 * HTTP response header, so this strips CR/LF and other C0 control characters first — Node's
 * `http` module throws on an embedded CR/LF, which would otherwise turn a crafted filename into
 * an unhandled 500 (research.md Decision 7). Emits both an ASCII-safe quoted `filename="..."`
 * (with internal `"`/`\` escaped) and an RFC 6266 `filename*=UTF-8''...` parameter, so non-ASCII
 * names round-trip correctly in modern clients while older clients still get a safe fallback.
 *
 * @param filename - The original, caller-supplied filename to encode.
 * @returns The full `Content-Disposition` header value.
 */
export function buildContentDisposition(filename: string): string {
  const stripped = filename.replace(CONTROL_CHARACTERS, "");
  const asciiSafe = stripped.replace(ASCII_UNSAFE, "\\$&");

  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(stripped)}`;
}
