export interface HealthStatus {
  status: "ok" | "not-ready";
  uptimeSeconds: number;
  timestamp: string;
}
