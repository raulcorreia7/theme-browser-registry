/**
 * Error handling utilities for the theme browser registry.
 *
 * @module utils/errors
 *
 * @example
 * ```typescript
 * import { AppError, isError, getErrorMessage } from "@/utils/errors";
 *
 * throw new AppError("Something went wrong", "ERR_SOMETHING");
 *
 * try {
 *   // some operation
 * } catch (err) {
 *   if (isError(err)) {
 *     console.log(getErrorMessage(err));
 *   }
 * }
 * ```
 */

/**
 * Application-specific error class with error codes.
 * Use this for domain errors that need to be distinguished by code.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Type guard to check if a value is an Error instance.
 *
 * @param error - Value to check
 * @returns true if the value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extracts a message string from an unknown error value.
 * Returns the error message if it's an Error, otherwise converts to string.
 *
 * @param error - Unknown error value
 * @returns Human-readable error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
