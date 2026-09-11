export type ResponseShape = "success" | "noBody" | "redirect" | "error";

export interface StatusCodeDemo {
  code: number;
  name: string;
  message: string;
  shape: ResponseShape;
  /** Present only when shape === "error"; the ErrorEnvelope's error.code value. */
  errorCode?: string;
  /** Static headers beyond X-Request-ID/Content-Type, e.g. Allow (405), Retry-After (429). */
  extraHeaders?: Record<string, string>;
}

export const DOCUMENTED_STATUS_CODES = [
  200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405, 406, 408, 409, 410, 415, 422, 429, 500,
  501, 502, 503, 504,
] as const;
