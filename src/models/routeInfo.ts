export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AuthType = "none" | "jwt" | "apiKey" | "basic" | "adminToken";

export interface AuthRequirement {
  type: AuthType;
  detail?: string;
}

export interface RouteInfo {
  method: HttpMethod;
  path: string;
  description: string;
  auth: AuthRequirement;
}
