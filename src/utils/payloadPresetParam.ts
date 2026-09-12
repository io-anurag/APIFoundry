import { HttpError } from "./httpError";
import { PAYLOAD_SIZE_PRESETS, type PayloadSizePreset } from "../data/payloadPresets.catalog";

/**
 * Parses a route's `:preset` path segment for `GET /payload/{preset}` into one of the documented
 * payload-size presets, rejecting anything else with `400` (FR-006).
 *
 * @param raw - The raw path segment value.
 * @returns The validated preset name.
 */
export function parsePayloadPresetParam(raw: string): PayloadSizePreset {
  if (!(PAYLOAD_SIZE_PRESETS as readonly string[]).includes(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", `Invalid payload preset '${raw}': must be one of ${PAYLOAD_SIZE_PRESETS.join(", ")}.`, {
      field: "preset",
      value: raw,
      supportedPresets: PAYLOAD_SIZE_PRESETS,
    });
  }

  return raw as PayloadSizePreset;
}
