import type { HealthStatus } from "../models/healthStatus";

/**
 * This spec has no async startup dependency (in-memory only, no DB to connect to), so `ready`
 * flips true synchronously once src/app.ts finishes wiring its request pipeline (see the
 * markReady() call there) rather than waiting on any external signal. The flag still exists as
 * the seam a later spec would use if it ever needs to delay readiness behind real async bootstrap
 * work (e.g. seeding a data store).
 */
let ready = false;

export function markReady(): void {
  ready = true;
}

export function isReady(): boolean {
  return ready;
}

function statusOf(status: HealthStatus["status"]): HealthStatus {
  return {
    status,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/** Always "ok" once the process is running — used by /health and /health/live. */
export function getLivenessStatus(): HealthStatus {
  return statusOf("ok");
}

/** Reflects the readiness flag — used by /health/ready. */
export function getReadinessStatus(): HealthStatus {
  return statusOf(ready ? "ok" : "not-ready");
}
