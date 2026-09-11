export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    requestId: string;
  };
}

export function buildErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details: Record<string, unknown> = {}
): ErrorEnvelope {
  return { error: { code, message, details, requestId } };
}
