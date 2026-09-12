import { z } from "zod";

/**
 * Wraps a numeric zod schema so it also accepts a numeric-looking string (as every environment
 * variable arrives) or an empty/missing value, coercing the latter to `undefined` so the schema's
 * own `.default(...)` can apply.
 *
 * @param schema - The base numeric schema to validate the coerced value against.
 * @returns A zod schema that preprocesses a raw env value into a number before validating it.
 */
function numeric(schema: z.ZodNumber) {
  return z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    return Number(value);
  }, schema);
}

/**
 * Builds a zod schema that coerces an environment variable's string form (e.g. `"true"`/`"false"`,
 * case-insensitive) — or an already-boolean value, or an empty/missing one — into a real boolean
 * before validation.
 *
 * @returns A zod boolean schema with the string-to-boolean preprocessing applied.
 */
function boolean() {
  return z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
  }, z.boolean());
}

export const envSchema = z.object({
  PORT: numeric(z.number().int().min(1).max(65535)).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PREFIX: z.string().min(1).startsWith("/").default("/api/v1"),
  CORS_ORIGIN: z.string().min(1).default("*"),

  JWT_SECRET: z.string().min(1).default("change-me"),
  JWT_ISSUER: z.string().min(1).default("mock-api-server"),
  JWT_AUDIENCE: z.string().min(1).default("mock-api-client"),
  JWT_EXPIRES_IN: numeric(z.number().int().positive()).default(3600),

  RATE_LIMIT_ENABLED: boolean().default(false),
  RATE_LIMIT_REQUESTS: numeric(z.number().int().positive()).default(100),
  RATE_LIMIT_WINDOW_MS: numeric(z.number().int().positive()).default(60000),

  MAX_DELAY_MS: numeric(z.number().int().nonnegative()).default(10000),
  MAX_PAYLOAD_SIZE: z.string().min(1).default("10mb"),

  FAILURE_RATE: numeric(z.number().min(0).max(1)).default(0),

  ADMIN_TOKEN: z.string().min(1).default("admin-secret"),
});

export type EnvSchema = z.infer<typeof envSchema>;
