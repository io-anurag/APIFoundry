import type { HealthStatus } from "../models/healthStatus";

/**
 * This spec has no async startup dependency (in-memory only, no DB to connect to), so `ready`
 * flips true synchronously once src/app.ts finishes wiring its request pipeline (see the
 * markReady() call there) rather than waiting on any external signal. The flag still exists as
 * the seam a later spec would use if it ever needs to delay readiness behind real async bootstrap
 * work (e.g. seeding a data store).
 */
let ready = false;

/**
 * Flips the module's readiness flag to true. Called once app.ts finishes wiring the request
 * pipeline, so `/health/ready` reports "ok" thereafter.
 *
 * @returns Nothing.
 */
export function markReady(): void {
  ready = true;
}

/**
 * Reads the current readiness flag.
 *
 * @returns True once `markReady` has been called, false otherwise.
 */
export function isReady(): boolean {
  return ready;
}

/**
 * Builds a `HealthStatus` snapshot for the given status value, stamped with the current process
 * uptime and timestamp.
 *
 * @param status - The status value to report ("ok" or "not-ready").
 * @returns The assembled `HealthStatus`.
 */
function statusOf(status: HealthStatus["status"]): HealthStatus {
  return {
    status,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds the liveness health status. Always "ok" once the process is running — used by /health and
 * /health/live.
 *
 * @returns A HealthStatus with status "ok", current process uptime, and a timestamp.
 */
export function getLivenessStatus(): HealthStatus {
  return statusOf("ok");
}

/**
 * Builds the readiness health status. Reflects the readiness flag — used by /health/ready.
 *
 * @returns A HealthStatus with status "ok" if `markReady` has been called, otherwise "not-ready", plus process uptime and a timestamp.
 */
export function getReadinessStatus(): HealthStatus {
  return statusOf(ready ? "ok" : "not-ready");
}
