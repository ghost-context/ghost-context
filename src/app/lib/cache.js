// src/app/lib/cache.js
import { kv } from '@vercel/kv';

// TTL values in seconds
export const TTL = {
  OWNER_COUNT: 60 * 60,          // 1 hour
  SOCIAL_PROFILE: 60 * 60,       // 1 hour
  POAP_EVENT: 5 * 60,            // 5 minutes
  COLLECTION_META: 24 * 60 * 60, // 24 hours
  TOKEN_HOLDERS: 30 * 60,        // 30 minutes
};

/**
 * Get cached value or fetch and cache.
 * Gracefully handles KV unavailability.
 *
 * Usage:
 *   const count = await getCached('key', fetchFn, TTL.OWNER_COUNT);
 */
export async function getCached(key, fetchFn, ttlSeconds) {
  // Try to read from cache
  try {
    const cached = await kv.get(key);
    if (cached !== null) {
      return cached;
    }
  } catch (e) {
    // KV unavailable or error, fall through to fetch
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Cache] KV read failed:', e.message);
    }
  }

  // Fetch fresh data
  const result = await fetchFn();

  // Try to write to cache
  try {
    await kv.set(key, result, { ex: ttlSeconds });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Cache] KV write failed:', e.message);
    }
  }

  return result;
}

/**
 * Invalidate a cached key.
 */
export async function invalidateCache(key) {
  try {
    await kv.del(key);
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Check if KV is available (for health checks).
 */
export async function isKVAvailable() {
  try {
    await kv.ping();
    return true;
  } catch {
    return false;
  }
}
