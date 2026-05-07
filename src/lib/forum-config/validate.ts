import { forumConfigSchema } from "./schema";
import type { ForumConfig } from "./schema";
import { ZodError } from "zod";

/**
 * Validation Helper (K-01)
 * 
 * Validates forum.config.json data against the schema.
 * Use this function before every write to the Tenant record.
 * 
 * @param input - The config object to validate (unknown type for safety)
 * @returns A result object with either validated data or error messages
 * 
 * @example
 * ```typescript
 * const result = validateForumConfig(userInput);
 * if (result.ok) {
 *   // Use result.data (typed as ForumConfig)
 *   await updateTenantConfig(result.data);
 * } else {
 *   // Handle validation errors
 *   return { errors: result.errors };
 * }
 * ```
 */
export function validateForumConfig(
  input: unknown
):
  | { ok: true; data: ForumConfig }
  | { ok: false; errors: string[] } {
  try {
    const data = forumConfigSchema.parse(input);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((e) => {
        const path = e.path.join(".");
        return `${path}: ${e.message}`;
      });
      return { ok: false, errors };
    }
    // Unexpected error type
    return {
      ok: false,
      errors: ["Unexpected validation error: " + String(error)],
    };
  }
}

/**
 * Safe parse with default fallback.
 * 
 * Attempts to parse the input, but if validation fails, returns the default config
 * instead of throwing. Useful for reading existing configs that may be malformed.
 * 
 * @param input - The config object to parse
 * @param fallback - The fallback config to return on validation failure
 * @returns The validated config or the fallback
 */
export function parseForumConfigSafe(
  input: unknown,
  fallback: ForumConfig
): ForumConfig {
  const result = forumConfigSchema.safeParse(input);
  return result.success ? result.data : fallback;
}
