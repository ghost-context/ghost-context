// src/app/lib/data-loader.js

/**
 * DataLoader batches and dedupes requests within a single tick.
 * Useful for avoiding duplicate API calls when multiple components
 * request the same data.
 *
 * Usage:
 *   const loader = new DataLoader(async (keys) => fetchAll(keys));
 *   const result = await loader.load(key);
 */
export class DataLoader {
  constructor(batchFn, options = {}) {
    this.batchFn = batchFn;
    this.cache = new Map();
    this.batch = [];
    this.batchPromise = null;
    this.maxBatchSize = options.maxBatchSize || 50;
    this.cacheKeyFn = options.cacheKeyFn || ((key) => JSON.stringify(key));
  }

  async load(key) {
    const cacheKey = this.cacheKeyFn(key);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Add to current batch
    const promise = new Promise((resolve, reject) => {
      this.batch.push({ key, cacheKey, resolve, reject });
    });

    // Schedule batch execution on next tick
    if (!this.batchPromise) {
      this.batchPromise = Promise.resolve().then(() => this._executeBatch());
    }

    return promise;
  }

  async loadMany(keys) {
    return Promise.all(keys.map(key => this.load(key)));
  }

  async _executeBatch() {
    const batch = this.batch;
    this.batch = [];
    this.batchPromise = null;

    if (batch.length === 0) return;

    const keys = batch.map(item => item.key);

    try {
      const results = await this.batchFn(keys);

      batch.forEach((item, index) => {
        const result = results[index];
        this.cache.set(item.cacheKey, result);
        item.resolve(result);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }

  prime(key, value) {
    const cacheKey = this.cacheKeyFn(key);
    this.cache.set(cacheKey, value);
  }

  clear(key) {
    if (key) {
      const cacheKey = this.cacheKeyFn(key);
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }
}
