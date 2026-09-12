export class HttpError extends Error {
  /**
   * Constructs an HttpError representing a single API error response.
   * @param statusCode - HTTP status code the response should use.
   * @param code - Machine-readable error code included in the error envelope.
   * @param message - Human-readable error message.
   * @param details - Additional structured context about the error (defaults to an empty object).
   */
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "HttpError";
  }
}
