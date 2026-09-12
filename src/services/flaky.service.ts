import { nextRandom } from "../utils/seededRandom";

export type FailureStatus = 500 | 502 | 503 | 504;

export interface FlakyOutcome {
  failed: boolean;
  status?: FailureStatus;
}

const FAILURE_STATUSES: readonly FailureStatus[] = [500, 502, 503, 504];

/**
 * Decides whether a single `GET /flaky` call fails, and with which status.
 *
 * `draw` is an injectable parameter (defaulting to the real shared `nextRandom`) so tests can
 * supply a fixed/fake draw function for edge-case assertions without depending on the real PRNG's
 * exact sequence.
 *
 * @param enabled - Master switch (`config.flakyEnabled`); when `false`, always succeeds and never
 *   consumes the shared PRNG's sequence (FR-008).
 * @param failureRate - Probability of failure, in `[0, 1]`.
 * @param draw - Source of randomness; defaults to the shared seeded PRNG.
 * @returns Whether this call failed and, if so, which status was chosen.
 */
export function rollFlakyOutcome(
  enabled: boolean,
  failureRate: number,
  draw: () => number = nextRandom
): FlakyOutcome {
  if (!enabled) return { failed: false };

  const roll = draw();
  if (roll >= failureRate) return { failed: false };

  const statusIndex = Math.floor(draw() * FAILURE_STATUSES.length);
  return { failed: true, status: FAILURE_STATUSES[statusIndex] };
}
