// src/app/lib/fetch-with-retry.js

/**
 * Fetch with automatic retry and exponential backoff.
 * Handles 429 (rate limit), 502, 503, 504 errors gracefully with automatic retries.
 *
 * Usage:
 *   const response = await fetchWithRetry(url, options, { maxRetries: 3 });
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    retryableStatuses = [429, 502, 503, 504],
  } = retryOptions;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      if (!retryableStatuses.includes(response.status)) {
        return response; // Non-retryable error, return as-is
      }

      lastError = new Error(`HTTP ${response.status}`);

      // Check for Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      let delayMs;

      if (retryAfter) {
        delayMs = parseInt(retryAfter, 10) * 1000;
      } else {
        // Exponential backoff with jitter
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * exponentialDelay;
        delayMs = Math.min(exponentialDelay + jitter, maxDelayMs);
      }

      if (attempt < maxRetries) {
        console.log(`[Retry] ${url.slice(0, 60)}... Attempt ${attempt + 1}/${maxRetries}, waiting ${Math.round(delayMs)}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.log(`[Retry] Network error, attempt ${attempt + 1}/${maxRetries}, waiting ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Convenience wrapper that also parses JSON response.
 */
export async function fetchJsonWithRetry(url, options = {}, retryOptions = {}) {
  const response = await fetchWithRetry(url, options, retryOptions);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
