import { rateLimitStore } from "../data/rateLimit.store";
import type { RateLimitCounter } from "../models/rateLimitCounter";

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSec: number;
}

/**
 * Checks and updates the given caller's rate-limit counter for the current window.
 *
 * `enabled`, `limit`, `windowMs`, and `now` are explicit parameters (not read from the global
 * `config` singleton) so automated tests can exercise the threshold/window-rollover/reset logic
 * deterministically and instantly, by passing explicit `now` timestamps, instead of needing
 * `RATE_LIMIT_ENABLED=true` in the real environment or a real window-length sleep (research.md
 * Decision 2). The caller (the controller) supplies the real configuration values.
 *
 * @param callerId - Identity used to scope the counter (see `resolveCallerIdentity`).
 * @param enabled - Whether rate limiting is active; when `false`, no state is read or written.
 * @param limit - Maximum requests allowed per window.
 * @param windowMs - Window length in milliseconds.
 * @param now - Current time in epoch ms (defaults to `Date.now()`).
 * @returns Whether the request is allowed, the remaining quota, the limit, and (when not allowed)
 *   the number of seconds until the window resets.
 */
export function checkRateLimit(
  callerId: string,
  enabled: boolean,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitCheck {
  if (!enabled) {
    return { allowed: true, remaining: limit, limit, retryAfterSec: 0 };
  }

  const existing = rateLimitStore.get(callerId);
  const windowExpired = !existing || now >= existing.windowStart + windowMs;

  const record: RateLimitCounter = windowExpired
    ? { id: callerId, count: 1, windowStart: now }
    : { id: callerId, count: existing.count + 1, windowStart: existing.windowStart };

  if (existing) {
    rateLimitStore.replace(callerId, () => record);
  } else {
    rateLimitStore.create(record);
  }

  const allowed = record.count <= limit;
  const remaining = Math.max(0, limit - record.count);
  const retryAfterSec = allowed ? 0 : Math.ceil((record.windowStart + windowMs - now) / 1000);

  return { allowed, remaining, limit, retryAfterSec };
}
