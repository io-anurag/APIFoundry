/**
 * Fixed catalog of named payload-size presets for `GET /payload/{preset}`. Exact byte counts
 * confirmed in spec.md's Clarifications session (data-model.md) — no lifecycle, a plain lookup
 * table.
 */
export const PAYLOAD_SIZE_PRESETS = ["small", "medium", "large"] as const;

export type PayloadSizePreset = (typeof PAYLOAD_SIZE_PRESETS)[number];

export const PAYLOAD_SIZE_PRESET_BYTES: Record<PayloadSizePreset, number> = {
  small: 1_024, // 1 KB
  medium: 102_400, // 100 KB
  large: 1_048_576, // 1 MB
};
