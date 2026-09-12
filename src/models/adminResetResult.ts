export interface AdminResetResult {
  message: string;
  domain: "data" | "auth";
  requestId: string;
}
