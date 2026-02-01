# Performance Optimizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce memory usage, minimize API calls, add persistent caching, enable streaming progress, and implement retry logic for the kindred spirits analysis pipeline.

**Architecture:** Create reusable lib utilities (TopK, DataLoader, cache, fetchWithRetry) and integrate them into the `analyze-combined-overlap` API route, with a new streaming endpoint for real-time progress.

**Tech Stack:** Next.js API routes, Vercel KV (Redis), Server-Sent Events

---

## Task 1: Create TopK Class

**Files:**
- Create: `src/app/lib/top-k.js`

**Step 1: Create the TopK class with min-heap implementation**

```javascript
// src/app/lib/top-k.js

/**
 * TopK maintains only the top K items using a min-heap.
 * Memory: O(k) instead of O(n) for large datasets.
 */
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
      // New item is larger than smallest in heap - replace
      this.heap[0] = item;
      this._bubbleDown(0);
    }
    // Otherwise item is too small - discard
  }

  getResults() {
    // Return sorted descending (largest first)
    return [...this.heap].sort((a, b) => this.compare(b, a));
  }

  get size() {
    return this.heap.length;
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

**Step 2: Verify no syntax errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/lib/top-k.js
git commit -m "feat: add TopK class for memory-efficient result sorting"
```

---

## Task 2: Integrate TopK into analyze-combined-overlap

**Files:**
- Modify: `src/app/api/analyze-combined-overlap/route.js`

**Step 1: Import TopK and replace overlapMap aggregation**

At the top of the file, add:
```javascript
import { TopK } from '../../lib/top-k.js';
```

**Step 2: Replace the results compilation section (lines 226-256)**

Find this code block:
```javascript
// ========================================
// 4. COMPILE RESULTS
// ========================================

console.log(`\n📊 Analysis Complete:`);
// ... through to .slice(0, 100);
```

Replace with:
```javascript
// ========================================
// 4. COMPILE RESULTS USING TOP-K
// ========================================

console.log(`\n📊 Analysis Complete:`);
console.log(`   Total wallets with ANY overlap: ${overlapMap.size}`);
console.log(`   Source wallet: ${address}`);

// Determine minimum overlap threshold
const minOverlap = totalAssets >= 2 ? 2 : 1;
console.log(`   Minimum overlap threshold: ${minOverlap} assets`);

// Use TopK to efficiently find top 100 results
const topK = new TopK(100, (a, b) => a.overlapCount - b.overlapCount);

let filteredCount = 0;
for (const [wallet, data] of overlapMap.entries()) {
  if (data.count >= minOverlap) {
    topK.push({
      address: wallet,
      overlapCount: data.count,
      overlapPercentage: ((data.count / totalAssets) * 100).toFixed(1),
      sharedAssets: {
        nfts: data.assets.nfts,
        poaps: data.assets.poaps,
        erc20s: data.assets.erc20s
      },
      totalShared: data.count
    });
  } else {
    filteredCount++;
  }
}

const kindredSpirits = topK.getResults();

console.log(`   Kindred spirits found (>= ${minOverlap} overlaps): ${kindredSpirits.length}`);
console.log(`   Filtered out (< ${minOverlap} overlaps): ${filteredCount}\n`);
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/analyze-combined-overlap/route.js
git commit -m "perf: use TopK algorithm for O(k) memory in result sorting"
```

---

## Task 3: Create fetchWithRetry Utility

**Files:**
- Create: `src/app/lib/fetch-with-retry.js`

**Step 1: Create the retry utility with exponential backoff**

```javascript
// src/app/lib/fetch-with-retry.js

/**
 * Fetch with automatic retry and exponential backoff.
 * Handles 429 (rate limit), 502, 503, 504 errors gracefully.
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
        console.log(`[Retry] ${url.slice(0, 50)}... Attempt ${attempt + 1}/${maxRetries}, waiting ${Math.round(delayMs)}ms`);
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
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/lib/fetch-with-retry.js
git commit -m "feat: add fetchWithRetry utility with exponential backoff"
```

---

## Task 4: Integrate fetchWithRetry into API routes

**Files:**
- Modify: `src/app/api/analyze-combined-overlap/route.js`
- Modify: `src/app/api/get-filtered-tokens/route.js`

**Step 1: Update analyze-combined-overlap to use fetchWithRetry**

Add import at top:
```javascript
import { fetchWithRetry } from '../../lib/fetch-with-retry.js';
```

In `fetchERC20Owners`, replace the fetch call (around line 144):
```javascript
// Before:
const response = await fetch(
  `${baseUrl}/erc20/${token.address}/owners?${params}`,
  { headers: { 'accept': 'application/json', 'X-API-Key': apiKey } }
);

// After:
const response = await fetchWithRetry(
  `${baseUrl}/erc20/${token.address}/owners?${params}`,
  { headers: { 'accept': 'application/json', 'X-API-Key': apiKey } },
  { maxRetries: 2, baseDelayMs: 500 }
);
```

**Step 2: Update get-filtered-tokens to use fetchWithRetry**

Add import at top:
```javascript
import { fetchWithRetry } from '../../lib/fetch-with-retry.js';
```

Replace both fetch calls (tokens fetch and holders fetch) with fetchWithRetry:
```javascript
const tokensResponse = await fetchWithRetry(tokensUrl, {
  headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
}, { maxRetries: 2, baseDelayMs: 500 });
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/analyze-combined-overlap/route.js src/app/api/get-filtered-tokens/route.js
git commit -m "perf: integrate fetchWithRetry for graceful rate limit handling"
```

---

## Task 5: Set Up Vercel KV and Create Cache Utility

**Files:**
- Create: `src/app/lib/cache.js`

**Step 1: Install Vercel KV package**

Run: `npm install @vercel/kv`

**Step 2: Create the cache utility**

```javascript
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
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds (KV will gracefully degrade without env vars)

**Step 4: Commit**

```bash
git add package.json package-lock.json src/app/lib/cache.js
git commit -m "feat: add Vercel KV cache utility with graceful degradation"
```

---

## Task 6: Integrate Caching into Token Filtering

**Files:**
- Modify: `src/app/api/get-filtered-tokens/route.js`

**Step 1: Add caching for holder counts**

Add import at top:
```javascript
import { getCached, TTL } from '../../lib/cache.js';
```

Replace the holder count fetch loop with cached version:

```javascript
// Before (inside the token processing):
const holdersResponse = await fetchWithRetry(holdersUrl, { ... });
const holdersData = await holdersResponse.json();
const holderCount = holdersData.totalHolders || 0;

// After:
const holderCount = await getCached(
  `holders:${token.token_address}:${chain}`,
  async () => {
    const holdersResponse = await fetchWithRetry(holdersUrl, {
      headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
    }, { maxRetries: 2, baseDelayMs: 500 });

    if (!holdersResponse.ok) return 0;
    const holdersData = await holdersResponse.json();
    return holdersData.totalHolders || 0;
  },
  TTL.TOKEN_HOLDERS
);
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/get-filtered-tokens/route.js
git commit -m "perf: cache token holder counts in Vercel KV"
```

---

## Task 7: Create Streaming Analysis Endpoint

**Files:**
- Create: `src/app/api/analyze-combined-overlap/stream/route.js`

**Step 1: Create the streaming endpoint**

```javascript
// src/app/api/analyze-combined-overlap/stream/route.js
import { MoralisConfig } from '../../../moralis-config.js';
import { processWithConcurrency } from '../../../lib/concurrency.js';
import { validateAddressParam } from '../../../lib/validation.js';
import { TopK } from '../../../lib/top-k.js';
import { fetchWithRetry } from '../../../lib/fetch-with-retry.js';

export async function POST(request) {
  const body = await request.json();
  const address = (body.address || '').trim().toLowerCase();
  const selectedNFTs = body.nfts || [];
  const selectedPOAPs = body.poaps || [];
  const selectedERC20s = body.erc20s || [];

  // Validate
  const validationError = validateAddressParam(address);
  if (validationError) return validationError;

  const totalAssets = selectedNFTs.length + selectedPOAPs.length + selectedERC20s.length;
  if (totalAssets === 0) {
    return new Response(
      JSON.stringify({ error: 'No assets selected' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const overlapMap = new Map();

        const addOverlap = (walletAddress, assetInfo, assetType) => {
          if (walletAddress.toLowerCase() === address) return;
          if (!overlapMap.has(walletAddress)) {
            overlapMap.set(walletAddress, { count: 0, assets: { nfts: [], poaps: [], erc20s: [] } });
          }
          const overlap = overlapMap.get(walletAddress);
          const assetKey = assetType === 'poap' ? assetInfo.eventId : assetInfo.address;
          const alreadyCounted = overlap.assets[`${assetType}s`].some(a =>
            (assetType === 'poap' ? a.eventId : a.address) === assetKey
          );
          if (!alreadyCounted) {
            overlap.count += 1;
            overlap.assets[`${assetType}s`].push(assetInfo);
          }
        };

        // Phase 1: NFTs
        if (selectedNFTs.length > 0) {
          send({ type: 'progress', phase: 'NFT holders', current: 0, total: selectedNFTs.length });
          for (let i = 0; i < selectedNFTs.length; i++) {
            const nft = selectedNFTs[i];
            const { AlchemyMultichainClient } = await import('../../../alchemy-multichain-client.js');
            const alchemy = new AlchemyMultichainClient();
            try {
              let owners = [];
              let pageKey;
              do {
                const resp = await alchemy.forNetwork(nft.network).nft.getOwnersForContract(nft.address, { pageKey });
                owners = owners.concat(resp?.owners || []);
                if (owners.length > 150000) break;
                pageKey = resp?.pageKey;
              } while (pageKey);

              for (const owner of owners) {
                const addr = typeof owner === 'string' ? owner : owner?.ownerAddress;
                if (addr) addOverlap(addr.toLowerCase(), { address: nft.address, network: nft.network, name: nft.name, type: 'NFT' }, 'nft');
              }
            } catch {}
            send({ type: 'progress', phase: 'NFT holders', current: i + 1, total: selectedNFTs.length });
          }
        }

        // Phase 2: POAPs
        if (selectedPOAPs.length > 0) {
          send({ type: 'progress', phase: 'POAP holders', current: 0, total: selectedPOAPs.length });
          for (let i = 0; i < selectedPOAPs.length; i++) {
            const poap = selectedPOAPs[i];
            try {
              let allHolders = [];
              let page = 0;
              let pageCount = 0;
              do {
                const res = await fetch(`http://localhost:3000/api/poap/event?id=${poap.eventId}&page=${page}`);
                if (!res.ok) break;
                const data = await res.json();
                const holders = data?.holders || [];
                pageCount = holders.length;
                allHolders = allHolders.concat(holders);
                page++;
                if (allHolders.length >= 150000) break;
              } while (pageCount === 500);

              for (const holder of allHolders) {
                addOverlap(holder.toLowerCase(), { eventId: poap.eventId, name: poap.name, type: 'POAP' }, 'poap');
              }
            } catch {}
            send({ type: 'progress', phase: 'POAP holders', current: i + 1, total: selectedPOAPs.length });
          }
        }

        // Phase 3: ERC-20s
        const apiKey = process.env.MORALIS_API_KEY;
        if (selectedERC20s.length > 0 && apiKey) {
          send({ type: 'progress', phase: 'ERC-20 holders', current: 0, total: selectedERC20s.length });
          for (let i = 0; i < selectedERC20s.length; i++) {
            const token = selectedERC20s[i];
            try {
              let allOwners = [];
              let cursor = null;
              do {
                const params = new URLSearchParams({ chain: '0x2105', limit: String(MoralisConfig.pageSize) });
                if (cursor) params.set('cursor', cursor);
                const response = await fetchWithRetry(
                  `https://deep-index.moralis.io/api/v2.2/erc20/${token.address}/owners?${params}`,
                  { headers: { 'accept': 'application/json', 'X-API-Key': apiKey } },
                  { maxRetries: 2 }
                );
                if (!response.ok) break;
                const data = await response.json();
                allOwners = allOwners.concat(data.result || []);
                cursor = data.cursor;
                if (allOwners.length > 150000) break;
              } while (cursor);

              for (const owner of allOwners) {
                addOverlap(owner.owner_address.toLowerCase(), { address: token.address, symbol: token.symbol, name: token.name, type: 'ERC-20' }, 'erc20');
              }
            } catch {}
            send({ type: 'progress', phase: 'ERC-20 holders', current: i + 1, total: selectedERC20s.length });
          }
        }

        // Phase 4: Calculate results
        send({ type: 'progress', phase: 'Calculating results', current: 0, total: 1 });

        const minOverlap = totalAssets >= 2 ? 2 : 1;
        const topK = new TopK(100, (a, b) => a.overlapCount - b.overlapCount);

        for (const [wallet, data] of overlapMap.entries()) {
          if (data.count >= minOverlap) {
            topK.push({
              address: wallet,
              overlapCount: data.count,
              overlapPercentage: ((data.count / totalAssets) * 100).toFixed(1),
              sharedAssets: data.assets,
              totalShared: data.count
            });
          }
        }

        send({ type: 'progress', phase: 'Calculating results', current: 1, total: 1 });

        // Send final results
        send({
          type: 'result',
          success: true,
          walletAddress: address,
          analyzedAssets: { nfts: selectedNFTs.length, poaps: selectedPOAPs.length, erc20s: selectedERC20s.length, total: totalAssets },
          kindredSpirits: topK.getResults(),
          totalKindredSpirits: topK.size,
          minOverlapThreshold: minOverlap,
          totalWalletsWithAnyOverlap: overlapMap.size
        });

      } catch (error) {
        send({ type: 'error', message: error.message });
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

**Step 2: Create the directory and verify build**

Run: `mkdir -p src/app/api/analyze-combined-overlap/stream && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/analyze-combined-overlap/stream/route.js
git commit -m "feat: add streaming endpoint for real-time analysis progress"
```

---

## Task 8: Create DataLoader Utility

**Files:**
- Create: `src/app/lib/data-loader.js`

**Step 1: Create the DataLoader class**

```javascript
// src/app/lib/data-loader.js

/**
 * DataLoader batches and dedupes requests within a single tick.
 * Useful for avoiding duplicate API calls when multiple components
 * request the same data.
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
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/lib/data-loader.js
git commit -m "feat: add DataLoader for request batching and deduplication"
```

---

## Task 9: Manual Testing

**Step 1: Set up Vercel KV (if not already done)**

1. Go to Vercel Dashboard → ghost-context project → Storage
2. Click "Create Database" → KV
3. Env vars are auto-added to project

**Step 2: Deploy and test**

Run: `git push`

Wait for Vercel deployment, then test:

1. Go to `/test-common-assets`
2. Enter wallet, fetch assets
3. Select some NFTs/POAPs/ERC-20s
4. Click "Find Kindred Spirits"
5. Watch for streaming progress (if using streaming endpoint)
6. Verify results appear correctly

**Step 3: Check Vercel logs**

Look for:
- `[Retry]` messages (429 handling working)
- `[Cache] KV read failed` (if KV not set up)
- Memory usage in function logs

**Step 4: Commit test verification**

```bash
git add -A
git commit -m "test: verify performance optimizations work correctly"
```

---

## Task 10: Update Design Doc and Cleanup

**Files:**
- Modify: `docs/plans/2026-01-09-performance-optimizations-design.md`

**Step 1: Mark design as complete**

Add at the top after the title:
```markdown
*Completed: 2026-02-01*

> **STATUS: COMPLETED** - Shipped in branch `sloan-updates-2`
```

**Step 2: Delete implementation plan**

Run: `rm docs/plans/2026-02-01-performance-optimizations-plan.md`

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: mark performance optimizations as complete"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create TopK class | `lib/top-k.js` |
| 2 | Integrate TopK | `analyze-combined-overlap/route.js` |
| 3 | Create fetchWithRetry | `lib/fetch-with-retry.js` |
| 4 | Integrate fetchWithRetry | Multiple API routes |
| 5 | Create cache utility | `lib/cache.js` |
| 6 | Add token caching | `get-filtered-tokens/route.js` |
| 7 | Create streaming endpoint | `analyze-combined-overlap/stream/route.js` |
| 8 | Create DataLoader | `lib/data-loader.js` |
| 9 | Manual testing | - |
| 10 | Cleanup | Design doc |

## Success Criteria

- [ ] Memory usage for large analyses reduced (TopK)
- [ ] 429 errors automatically retry (fetchWithRetry)
- [ ] Holder counts cached in Vercel KV
- [ ] Streaming endpoint provides real-time progress
- [ ] DataLoader available for future batching needs
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
