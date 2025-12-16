# Performance Optimization Plan

This document outlines performance bottlenecks identified in the Ghost Context application and recommended fixes.

## Critical Issues

### 1. Sequential API Calls in Kindred Spirits Analysis
**File:** `src/app/components/KindredSpiritsList.js` (lines 150-209)

**Problem:** Collections are processed one-at-a-time using `for...await`. Each collection fetches all holder pages sequentially before moving to the next.

**Impact:** 5 collections × 10 pages each = 50 sequential API calls = ~25 seconds minimum wait time.

**Fix:** Parallelize collection fetching with controlled concurrency (e.g., 3-5 concurrent collections).

---

### 2. N+1 Query Problem for Owner Counts
**File:** `src/app/components/NftTableList.js` (lines 276-297)

**Problem:** Each visible collection triggers a separate `getOwnersCountForContract()` call when rendered.

**Impact:** Displaying 20 collections = 20 simultaneous Alchemy requests, leading to 429 rate limiting and slow table load.

**Fix:** Batch owner count requests or fetch counts during initial collection load.

---

### 3. Individual Social Lookups per Card
**File:** `src/app/components/SocialCard.js` (lines 9-22)

**Problem:** Each `SocialCard` component makes its own Airstack API call in a `useEffect`.

**Impact:** 20 kindred spirits = 20 concurrent API calls, causing 20-30 second load times for the kindred spirits section.

**Fix:** Batch social lookups at the parent level, pass data down as props. Add `React.memo` to prevent re-renders.

---

### 4. Memory Bloat in Server Analysis
**File:** `src/app/api/analyze-combined-overlap/route.js` (lines 29-62)

**Problem:** Stores full asset objects for every wallet in `overlapMap`. With 5 collections × 150k holders, this creates 750k+ entries.

**Impact:** 500MB+ server memory usage, potential crashes on large analyses.

**Fix:** Use streaming responses or implement top-K algorithm to avoid storing all results.

---

## Easy Wins (Quick Fixes)

### Remove Debug Logging in useMemo
**File:** `src/app/components/NftTableList.js` (lines 200-229)

```javascript
// Remove or comment out this block inside useMemo:
if (typeof window !== 'undefined') {
  try {
    console.log('sort:newest sample', arr.slice(0, 5).map(c => ({...})));
  } catch {}
}
```
**Time:** 2 minutes

---

### Memoize EnsContext Value
**File:** `src/app/page.js` (line 15)

```javascript
// Before:
<EnsContext.Provider value={{ ensAddress, setEnsAddress }}>

// After:
const ensContextValue = useMemo(
  () => ({ ensAddress, setEnsAddress }),
  [ensAddress]
);
<EnsContext.Provider value={ensContextValue}>
```
**Time:** 5 minutes

---

### Add useMemo to Collection Filtering
**File:** `src/app/components/NftTableList.js` (lines 84-111)

The filtering logic recalculates on every render. Wrap in `useMemo` with appropriate dependencies.

**Time:** 5 minutes

---

### Wrap SocialCard in React.memo
**File:** `src/app/components/SocialCard.js`

```javascript
// Before:
export const SocialCard = ({ airstack, address, count }) => {

// After:
export const SocialCard = React.memo(({ airstack, address, count }) => {
  // ... component body
});
```
**Time:** 5 minutes

---

### Increase BATCH_SIZE for Transfer Timestamps
**File:** `src/app/components/NftTableList.js` (line 250)

```javascript
// Before:
const BATCH_SIZE = 1;

// After:
const BATCH_SIZE = 4;
```
**Time:** 5 minutes
**Impact:** Speeds up "Newest" sorting by 3-4x

---

### Memoize NftModal Data Transform
**File:** `src/app/components/NftModal.js` (lines 10-26)

Replace async `useEffect` with synchronous `useMemo` for the simple data transformation.

**Time:** 5 minutes

---

## Medium Effort Improvements

### Parallelize NFT/POAP Fetching Loop
**File:** `src/app/components/KindredSpiritsList.js`

**Current flow:**
```
FOR each collection (sequential):
  FOR each page (sequential):
    FETCH and WAIT
```

**Target flow:**
```
FOR each collection (parallel, limit 3-5):
  FOR each page (sequential within collection):
    FETCH and WAIT
```

**Time:** ~1 hour
**Impact:** Reduce analysis time from 2-5 minutes to 30-60 seconds

---

### Add Caching to POAP Routes
**File:** `src/app/api/poap/event/route.js`

Remove `cache: 'no-store'` from fetch calls, implement in-memory or Redis caching for POAP event data.

**Time:** 30 minutes

---

### Batch Social Lookups
**File:** `src/app/components/KindredSpiritsList.js`

Fetch all social data at once after kindred spirits are identified, then pass to child components.

**Time:** 30 minutes

---

## Larger Refactoring (Future)

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Implement DataLoader pattern for request batching | 3-4 hours | 40-60% fewer API calls |
| Add Redis/KV caching layer | 3-4 hours | 70% fewer repeated API calls |
| Streaming responses for long analyses | 3-4 hours | Better UX, progressive results |
| Top-K algorithm for result sorting | 2-3 hours | 70% less server memory |
| Adaptive rate limiting with exponential backoff | 2-3 hours | Graceful degradation under load |

---

## Implementation Order

**Phase 1 - Easy Wins (~30 minutes):**
1. Remove debug logging
2. Memoize context values
3. Add useMemo to filtering
4. Wrap SocialCard in React.memo
5. Increase BATCH_SIZE
6. Memoize NftModal

**Phase 2 - Medium Effort (~2-3 hours):**
1. Parallelize collection fetching
2. Add POAP caching
3. Batch social lookups

**Phase 3 - Major Refactoring (future sprint):**
1. DataLoader pattern
2. Redis caching
3. Streaming responses
