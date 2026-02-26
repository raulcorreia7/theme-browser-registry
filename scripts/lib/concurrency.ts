/**
 * Concurrency utilities for parallelizing async operations
 */

/**
 * Execute async functions with a concurrency limit
 * @template T Input type
 * @template R Return type
 * @param items Items to process
 * @param concurrency Maximum number of concurrent operations
 * @param fn Async function to apply to each item
 * @param onProgress Optional callback for progress updates
 * @returns Array of results in the same order as input
 */
export async function limit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  onProgress?: (idx: number, result: R) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  let active = 0;
  let completed = 0;

  return new Promise((resolve, reject) => {
    const runNext = () => {
      if (completed === items.length) {
        resolve(results);
        return;
      }

      while (active < concurrency && index < items.length) {
        const currentIndex = index++;
        active++;

        Promise.resolve(fn(items[currentIndex]))
          .then((result) => {
            results[currentIndex] = result;
            onProgress?.(currentIndex, result);
          })
          .catch(reject)
          .finally(() => {
            active--;
            completed++;
            runNext();
          });
      }
    };

    runNext();
  });
}

/**
 * Batch array into chunks for batch processing
 * @template T Type of array elements
 * @param array Array to chunk
 * @param size Chunk size
 * @returns Array of chunks
 */
export function batch<T>(array: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}

/**
 * Process items in parallel batches to balance throughput and resource usage
 * @template T Input type
 * @template R Return type
 * @param items Items to process
 * @param batchSize Number of items per batch
 * @param fn Async function to apply to each batch
 * @returns Flattened array of all results
 */
export async function parallelBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const batches = batch(items, batchSize);
  const results = await Promise.all(batches.map((b) => fn(b)));
  return results.flat();
}

/**
 * Map with concurrency control - like Promise.all but with limited concurrency
 * @template T Input type
 * @template R Return type
 * @param items Items to map over
 * @param concurrency Maximum concurrent operations
 * @param fn Mapping function (receives item and index)
 * @returns Array of results
 */
export function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  return limit(items, concurrency, (item) => {
    const idx = items.indexOf(item);
    return fn(item, idx);
  });
}

/**
 * Retry an async operation with exponential backoff
 * @template T Return type
 * @param fn Async function to retry
 * @param retries Number of retry attempts
 * @param delay Initial delay in ms (doubles each retry)
 * @returns Result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}
