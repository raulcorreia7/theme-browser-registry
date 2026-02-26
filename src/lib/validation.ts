/**
 * Validation module for theme-browser-registry.
 *
 * Provides a unified, intuitive API for validating data against Zod schemas.
 * All validation functions follow the pattern: validate(schema, data)
 *
 * @example
 * // Strict validation - throws on error
 * const entry = validate(ThemeEntrySchema, data);
 *
 * @example
 * // Safe validation - returns result object
 * const result = validateSafe(ThemeEntrySchema, data);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */

import { z, ZodError, ZodSchema } from "zod";

/**
 * Result of safe validation.
 *
 * @template T The expected type of validated data
 */
export type ValidationResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: ZodError };

/**
 * Validates data against a Zod schema.
 * Throws a ZodError if validation fails.
 *
 * @template T The Zod schema type
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns The parsed and typed data
 * @throws {ZodError} When validation fails
 *
 * @example
 * const entry = validate(ThemeEntrySchema, rawData);
 * // entry is typed as ThemeEntry
 */
export function validate<T extends ZodSchema>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safely validates data against a Zod schema.
 * Returns a result object instead of throwing on error.
 *
 * @template T The Zod schema type
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns ValidationResult with success flag, data, and optional error
 *
 * @example
 * const result = validateSafe(ThemeEntrySchema, rawData);
 * if (result.success) {
 *   console.log(result.data.name);
 * } else {
 *   console.error('Validation failed:', result.error.message);
 * }
 */
export function validateSafe<T extends ZodSchema>(
  schema: T,
  data: unknown,
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
