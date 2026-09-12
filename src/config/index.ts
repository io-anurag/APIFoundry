import "dotenv/config";
import { envSchema } from "./env.schema";

export interface ConfigurationProfile {
  readonly port: number;
  readonly nodeEnv: "development" | "test" | "production";
  readonly apiPrefix: string;
  readonly corsOrigin: string;
  readonly jwtSecret: string;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly jwtExpiresIn: number;
  readonly rateLimitEnabled: boolean;
  readonly rateLimitRequests: number;
  readonly rateLimitWindowMs: number;
  readonly maxDelayMs: number;
  readonly maxPayloadSize: string;
  readonly maxFileSize: string;
  readonly maxStoredFiles: number;
  readonly failureRate: number;
  readonly flakyEnabled: boolean;
  readonly adminToken: string;
}

export class ConfigValidationError extends Error {
  /**
   * Constructs a ConfigValidationError carrying an aggregated, human-readable description of why
   * environment configuration failed validation.
   * @param message - Human-readable message describing the validation failures.
   */
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/**
 * Pure validation step: parses and validates the given environment variables,
 * throwing one aggregated, human-readable ConfigValidationError instead of exiting,
 * so it can be exercised directly in tests without killing the test process.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ConfigurationProfile {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new ConfigValidationError(`Invalid environment configuration:\n${issues}`);
  }

  const parsed = result.data;

  return Object.freeze({
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    apiPrefix: parsed.API_PREFIX,
    corsOrigin: parsed.CORS_ORIGIN,
    jwtSecret: parsed.JWT_SECRET,
    jwtIssuer: parsed.JWT_ISSUER,
    jwtAudience: parsed.JWT_AUDIENCE,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN,
    rateLimitEnabled: parsed.RATE_LIMIT_ENABLED,
    rateLimitRequests: parsed.RATE_LIMIT_REQUESTS,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    maxDelayMs: parsed.MAX_DELAY_MS,
    maxPayloadSize: parsed.MAX_PAYLOAD_SIZE,
    maxFileSize: parsed.MAX_FILE_SIZE,
    maxStoredFiles: parsed.MAX_STORED_FILES,
    failureRate: parsed.FAILURE_RATE,
    flakyEnabled: parsed.FLAKY_ENABLED,
    adminToken: parsed.ADMIN_TOKEN,
  });
}

/**
 * Loads configuration from `process.env` for real process startup: on a validation failure it
 * prints the error message and exits the process (`process.exit(1)`) instead of throwing, since an
 * unusable configuration should stop the server before it starts listening. Any other, unexpected
 * error is rethrown.
 *
 * @returns The validated, frozen configuration profile.
 */
function loadConfigOrExit(): ConfigurationProfile {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      // eslint-disable-next-line no-console
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

export const config: ConfigurationProfile = loadConfigOrExit();
