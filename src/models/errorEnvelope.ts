export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    requestId: string;
  };
}

/**
 * Builds the standard error response envelope (`{ error: { code, message, details, requestId } }`)
 * used by every error response returned by the API.
 * @param code - Machine-readable error code.
 * @param message - Human-readable error message.
 * @param requestId - Request ID to echo back for correlation with logs.
 * @param details - Additional structured context about the error (defaults to an empty object).
 * @returns The assembled error envelope.
 */
export function buildErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details: Record<string, unknown> = {}
): ErrorEnvelope {
  return { error: { code, message, details, requestId } };
}
