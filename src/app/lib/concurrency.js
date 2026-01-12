/**
 * Process items with limited concurrency
 * @param {Array} items - Items to process
 * @param {number} concurrency - Maximum concurrent operations
 * @param {Function} processor - Async function to process each item
 * @returns {Promise<Array>} Results from all processors
 */
export async function processWithConcurrency(items, concurrency, processor) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const promise = processor(item).then(result => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}
