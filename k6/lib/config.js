// Shared config for every k6 script in this directory. BASE_URL is read from k6's `__ENV` object
// so the same scripts can target a local dev server, a CI-started instance, or a deployed one
// without editing the scripts themselves (e.g. `k6 run -e BASE_URL=https://example.com smoke.js`).
export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
export const API_PREFIX = "/api/v1";
