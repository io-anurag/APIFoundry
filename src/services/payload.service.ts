import bytes from "bytes";
import type { Request } from "express";
import { config } from "../config";
import { PAYLOAD_SIZE_PRESET_BYTES } from "../data/payloadPresets.catalog";
import { parsePayloadPresetParam } from "../utils/payloadPresetParam";
import { parsePayloadSizeParam } from "../utils/payloadSizeParam";

/**
 * Generates a response body whose serialized `JSON.stringify(...)` form is exactly `targetBytes`
 * bytes. Builds the minimal shell `{ size: targetBytes, data: "" }`, measures its own byte length,
 * and pads `data` with plain ASCII `"a"` filler characters (never escaped by `JSON.stringify`, so
 * each contributes exactly one byte) to make up the difference (research.md Decision 5 for Spec
 * 007). For a `targetBytes` smaller than the shell's own overhead, returns the minimal shell with
 * an empty `data` rather than erroring (spec.md Edge Cases: `size=0` is a valid, minimal `200`).
 *
 * @param targetBytes - The exact byte count the serialized response body should occupy.
 * @returns `{ size, data }`, where `data` is a filler string sized so the full JSON output is
 *   exactly `targetBytes` bytes whenever `targetBytes >= shellBytes`.
 */
export function generatePayload(targetBytes: number): { size: number; data: string } {
  const shell = { size: targetBytes, data: "" };
  const shellBytes = Buffer.byteLength(JSON.stringify(shell), "utf8");
  const fillerLength = Math.max(0, targetBytes - shellBytes);
  return { size: targetBytes, data: "a".repeat(fillerLength) };
}

/**
 * Resolves `GET /payload/:preset` into a generated payload of that preset's configured byte size.
 *
 * @param rawPreset - The raw `:preset` path segment.
 * @returns The generated payload for the validated preset.
 */
export function getPayloadByPreset(rawPreset: string): { size: number; data: string } {
  const preset = parsePayloadPresetParam(rawPreset);
  return generatePayload(PAYLOAD_SIZE_PRESET_BYTES[preset]);
}

/**
 * Resolves `GET /payload?size=` into a generated payload of the requested byte size, bounded by
 * `config.maxPayloadSize`.
 *
 * @param rawSize - The raw `?size=` query value.
 * @returns The generated payload for the validated size.
 */
export function getPayloadBySize(rawSize: unknown): { size: number; data: string } {
  // config.maxPayloadSize is validated non-empty at config load time and shares its format with
  // express.json()'s own `limit` option (Foundational T003), so a parse failure here would mean
  // the same misconfiguration already broke request-body limiting; the non-null assertion mirrors
  // that shared trust boundary rather than re-validating admin-controlled configuration per request.
  const maxBytes = bytes.parse(config.maxPayloadSize) as number;
  const size = parsePayloadSizeParam(rawSize, maxBytes);
  return generatePayload(size);
}

/**
 * Reports the exact byte length of a `POST /payload` request body, read from `req.rawBody`
 * (populated by `captureRawBody`, Foundational T002) rather than re-serializing the parsed JSON
 * value, guaranteeing byte-exactness (research.md Decision 2). A genuinely empty body leaves
 * `req.rawBody` `undefined`, reported as `0`.
 *
 * @param req - The incoming request; `req.rawBody` carries the raw bytes captured before parsing.
 * @returns `{ received: true, contentLength }`.
 */
export function echoPayload(req: Request): { received: true; contentLength: number } {
  return { received: true, contentLength: req.rawBody?.length ?? 0 };
}
