/**
 * Concurrency utilities using p-limit.
 */
export { default as pLimit } from "p-limit";
export type { Limit } from "p-limit";

import pLimit from "p-limit";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export async function retry<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; delayMs?: number },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const delayMs = options?.delayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export function createLimit(concurrency: number) {
  return pLimit(concurrency);
}
