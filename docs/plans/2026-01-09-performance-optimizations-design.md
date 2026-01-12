# Performance Optimizations Design
*Created: 2026-01-09*

## Overview

Address memory and efficiency issues in the analysis pipeline. These optimizations focus on reducing server memory usage, minimizing API calls, and improving UX for long-running operations.

**Estimated time:** 14-17 hours

## Current Issues

1. **Memory bloat** - `analyze-combined-overlap` stores 750k+ entries in `overlapMap` for large analyses
2. **Redundant API calls** - Same data fetched multiple times within a request
3. **No persistent caching** - Cache resets between serverless invocations
4. **Blocking responses** - Users wait with no feedback during long analyses
5. **Hard failures on rate limits** - No graceful degradation when APIs throttle

## Tasks

### 1. Top-K Algorithm for Result Sorting (~2-3h)

**Problem:** Currently stores ALL wallet overlaps in memory, then sorts to find top 100. With 5 collections x 150k holders = 750k+ entries using 500MB+ memory.

**Solution:** Use a min-heap to maintain only the top K results during processing.

```javascript
// src/app/lib/top-k.js
export class TopK {
  constructor(k, compareFn) {
    this.k = k;
    this.heap = [];
    this.compare = compareFn || ((a, b) => a - b);
  }

  push(item) {
    if (this.heap.length < this.k) {
      this.heap.push(item);
      this._bubbleUp(this.heap.length - 1);
    } else if (this.compare(item, this.heap[0]) > 0) {
      // New item is larger than smallest in heap
      this.heap[0] = item;
      this._bubbleDown(0);
    }
    // Otherwise, item is too small - discard
  }

  getResults() {
    return [...this.heap].sort((a, b) => this.compare(b, a));
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parent]) >= 0) break;
      [this.heap[index], this.heap[parent]] = [this.heap[parent], this.heap[index]];
      index = parent;
    }
  }

  _bubbleDown(index) {
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < this.heap.length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}
```

**Usage in analyze-combined-overlap:**
```javascript
import { TopK } from '../../lib/top-k.js';

// Instead of:
const overlapMap = {};
for (const owner of owners) {
  overlapMap[owner] = (overlapMap[owner] || 0) + 1;
}
const sorted = Object.entries(overlapMap).sort((a, b) => b[1] - a[1]).slice(0, 100);

// Use:
const topK = new TopK(100, (a, b) => a.count - b.count);
const counts = {};
for (const owner of owners) {
  counts[owner] = (counts[owner] || 0) + 1;
  // Only track when we've seen all collections for this owner
}
// After processing, push final counts
for (const [address, count] of Object.entries(counts)) {
  topK.push({ address, count });
}
const results = topK.getResults();
```

**Impact:** Memory usage drops from O(n) to O(k) where k=100. For 750k entries, this is ~7500x reduction.

---

### 2. DataLoader Pattern for Request Batching (~3-4h)

**Problem:** Multiple components request the same data (owner counts, social profiles) separately, resulting in duplicate API calls.

**Solution:** Implement DataLoader pattern to batch and dedupe requests within a single tick.

```javascript
// src/app/lib/data-loader.js
export class DataLoader {
  constructor(batchFn, options = {}) {
    this.batchFn = batchFn;
    this.cache = new Map();
    this.batch = [];
    this.batchPromise = null;
    this.maxBatchSize = options.maxBatchSize || 50;
  }

  async load(key) {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Add to current batch
    const promise = new Promise((resolve, reject) => {
      this.batch.push({ key, resolve, reject });
    });

    // Schedule batch execution on next tick
    if (!this.batchPromise) {
      this.batchPromise = Promise.resolve().then(() => this._executeBatch());
    }

    return promise;
  }

  async _executeBatch() {
    const batch = this.batch;
    this.batch = [];
    this.batchPromise = null;

    const keys = batch.map(item => item.key);

    try {
      const results = await this.batchFn(keys);

      batch.forEach((item, index) => {
        const result = results[index];
        this.cache.set(item.key, result);
        item.resolve(result);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }

  clear() {
    this.cache.clear();
  }
}
```

**Usage for owner counts:**
```javascript
const ownerCountLoader = new DataLoader(async (keys) => {
  // keys = [{ network, contract }, ...]
  // Batch fetch all at once or use concurrency
  return Promise.all(keys.map(k =>
    alchemy.getOwnersCountForContract(k.network, k.contract)
  ));
});

// Components call:
const count = await ownerCountLoader.load({ network: 'eth', contract: '0x...' });
```

**Impact:** 40-60% fewer API calls when multiple components request overlapping data.

---

### 3. Redis/KV Caching Layer (~3-4h)

**Problem:** Next.js fetch cache is per-request. Serverless functions don't share memory between invocations.

**Solution:** Add Vercel KV (Redis) for persistent caching across requests.

```bash
npm install @vercel/kv
```

```javascript
// src/app/lib/cache.js
import { kv } from '@vercel/kv';

const TTL = {
  OWNER_COUNT: 60 * 60,        // 1 hour
  SOCIAL_PROFILE: 60 * 60,     // 1 hour
  POAP_EVENT: 5 * 60,          // 5 minutes
  COLLECTION_META: 24 * 60 * 60, // 24 hours
};

export async function getCached(key, fetchFn, ttlSeconds) {
  try {
    const cached = await kv.get(key);
    if (cached !== null) {
      return cached;
    }
  } catch (e) {
    // KV unavailable, fall through to fetch
    console.warn('[Cache] KV read failed:', e.message);
  }

  const result = await fetchFn();

  try {
    await kv.set(key, result, { ex: ttlSeconds });
  } catch (e) {
    console.warn('[Cache] KV write failed:', e.message);
  }

  return result;
}

// Usage
export async function getOwnerCountCached(network, contract) {
  const key = `owner-count:${network}:${contract}`;
  return getCached(
    key,
    () => alchemy.getOwnersCountForContract(network, contract),
    TTL.OWNER_COUNT
  );
}
```

**Environment setup:**
```bash
# .env.local
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

**Impact:** 70% fewer repeated API calls across all users. Owner counts and social profiles persist for 1 hour.

---

### 4. Streaming Responses for Long Analyses (~3-4h)

**Problem:** Users see no feedback during 10-30 second analyses. The entire response is buffered until complete.

**Solution:** Use Server-Sent Events (SSE) or ReadableStream to send progress updates.

```javascript
// src/app/api/analyze-combined-overlap/stream/route.js
export async function POST(request) {
  const body = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendProgress = (phase, current, total) => {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'progress', phase, current, total })}\n\n`
        ));
      };

      const sendResult = (result) => {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'result', ...result })}\n\n`
        ));
      };

      try {
        // Phase 1: Fetch NFT owners
        sendProgress('Fetching NFT holders', 0, body.nfts.length);
        for (let i = 0; i < body.nfts.length; i++) {
          await fetchNFTOwners(body.nfts[i]);
          sendProgress('Fetching NFT holders', i + 1, body.nfts.length);
        }

        // Phase 2: Fetch POAP holders
        sendProgress('Fetching POAP holders', 0, body.poaps.length);
        // ... etc

        // Phase 3: Calculate overlaps
        sendProgress('Calculating overlaps', 0, 1);
        const results = calculateOverlaps(/* ... */);

        sendResult({ results });
      } catch (error) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
        ));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Client-side usage:**
```javascript
async function analyzeWithProgress(params, onProgress) {
  const response = await fetch('/api/analyze-combined-overlap/stream', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n\n').filter(Boolean);

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'progress') {
          onProgress(data);
        } else if (data.type === 'result') {
          return data.results;
        }
      }
    }
  }
}
```

**Impact:** Real-time progress feedback. Users see "Fetching NFT holders 3/5" instead of a spinner.

---

### 5. Adaptive Rate Limiting with Exponential Backoff (~2-3h)

**Problem:** When APIs return 429 (rate limited), the request fails immediately. No retry logic.

**Solution:** Implement exponential backoff with jitter for graceful degradation.

```javascript
// src/app/lib/fetch-with-retry.js
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
        return response; // Non-retryable error
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
        console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries}, waiting ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
```

**Usage:**
```javascript
// In API routes
const response = await fetchWithRetry(
  `https://api.poap.tech/event/${id}/poaps`,
  { headers },
  { maxRetries: 3, baseDelayMs: 500 }
);
```

**Impact:** Graceful handling of temporary API issues. Requests retry intelligently instead of failing immediately.

---

## Checklist

### Phase 1: Memory Optimization (2-3h)
- [ ] Create `src/app/lib/top-k.js`
- [ ] Add unit tests for TopK class
- [ ] Integrate into `analyze-combined-overlap/route.js`
- [ ] Verify memory usage reduction
- [ ] Test with large collection sets

### Phase 2: Request Batching (3-4h)
- [ ] Create `src/app/lib/data-loader.js`
- [ ] Add unit tests for DataLoader
- [ ] Create loaders for owner counts, social profiles
- [ ] Integrate into components
- [ ] Verify API call reduction

### Phase 3: Persistent Caching (3-4h)
- [ ] Set up Vercel KV
- [ ] Create `src/app/lib/cache.js`
- [ ] Add caching to owner count fetching
- [ ] Add caching to social profile lookups
- [ ] Add caching to POAP event data
- [ ] Verify cache hits in logs

### Phase 4: Streaming Responses (3-4h)
- [ ] Create `/api/analyze-combined-overlap/stream/route.js`
- [ ] Implement SSE protocol
- [ ] Create client-side consumer hook
- [ ] Update UI to show streaming progress
- [ ] Test with slow connections

### Phase 5: Retry Logic (2-3h)
- [ ] Create `src/app/lib/fetch-with-retry.js`
- [ ] Add unit tests
- [ ] Integrate into API routes
- [ ] Test with simulated 429 responses
- [ ] Verify backoff timing

## Success Criteria

- Memory usage for large analyses drops by 90%+
- API calls reduced by 40-60% for typical usage
- Cache hit rate > 50% for owner counts
- Users see real-time progress during analysis
- 429 errors automatically retry and succeed
- No regressions in functionality
- Build passes
