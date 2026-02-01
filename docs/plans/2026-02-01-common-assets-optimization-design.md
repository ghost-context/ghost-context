# Common Assets Optimization Design
*Created: 2026-02-01*
*Completed: 2026-02-01*

> **STATUS: COMPLETED** - Shipped in branch `sloan-updates-2`

## Overview

Optimize the "Find Common Assets" feature to avoid redundant API calls by reusing already-loaded source wallet assets and fetching kindred spirit assets in parallel.

**Estimated time:** 3-4 hours

## Problem

The current `findCommonAssets()` function (lines 661-926 in `test-common-assets/page.js`) re-fetches assets for ALL wallets, including the source wallet whose assets are already loaded from Step 1.

**Current flow:**
```
For EACH wallet (source + all selected spirits):
  1. Fetch NFTs (sequential)
  2. Fetch POAPs (sequential)
  3. Fetch ERC-20s (sequential)
Then: Compute intersection
```

**Example:** Source wallet (1374 assets) + 2 kindred spirits (~800 assets each):
- 3972 sequential asset fetches across 3 wallets
- Source wallet re-fetched unnecessarily
- Wall-clock time: ~12+ seconds

## Solution

**Optimized flow:**
```
1. Use source wallet assets (already loaded from Step 1)
2. Fetch all kindred spirits' assets in PARALLEL
3. Compute intersection, starting with smallest set
```

**Same example optimized:**
- 0 fetches for source (reuse existing)
- ~1600 parallel fetches for 2 kindred spirits (concurrent)
- Wall-clock time: ~4 seconds

---

## Implementation

### 1. Restructure `findCommonAssets()`

```javascript
const findCommonAssets = async () => {
  // 1. Source wallet assets — ALREADY LOADED
  const sourceAssets = {
    nfts: nftCollections,      // From Step 1
    poaps: poapEvents,         // From Step 1
    erc20s: erc20Tokens        // From Step 1
  };

  // 2. Build list of spirits to fetch
  const spiritsToFetch = Array.from(selectedSpirits);

  // 3. Fetch ALL spirits' assets in PARALLEL
  const spiritAssets = await Promise.all(
    spiritsToFetch.map(address => fetchWalletAssets(address))
  );

  // 4. Combine source + spirits for intersection
  const allWallets = includeSourceWallet
    ? [{ address: walletAddress, ...sourceAssets }, ...spiritAssets]
    : spiritAssets;

  // 5. Compute intersection (smallest set first)
  const commonAssets = computeIntersection(allWallets);
};
```

### 2. New Helper: `fetchWalletAssets(address)`

Fetches NFTs, POAPs, and ERC-20s for a single wallet, with all three running in parallel:

```javascript
async function fetchWalletAssets(address) {
  const alchemy = new AlchemyMultichainClient();
  const poapClient = new PoapClient();

  // Fetch all 3 asset types in parallel
  const [nftsResult, poapsResult, erc20sResult] = await Promise.allSettled([
    // NFTs
    (async () => {
      const collections = await alchemy.getCollectionsForOwner(address, 'relevant');
      return collections
        .filter(nft => nft.network !== 'POAP' && !nft.network?.toLowerCase().includes('poap'))
        .map(nft => ({
          id: `${nft.network}-${nft.contract_address}`,
          address: nft.contract_address,
          network: nft.network,
          name: nft.name || 'Unknown Collection',
          image: nft.image_small_url || nft.image
        }));
    })(),

    // POAPs
    (async () => {
      const poapData = await poapClient.scanAddress(address);
      const poaps = poapData?.events || poapData?.poaps || [];
      const unique = new Map();
      for (const poap of poaps) {
        const eventId = String(poap.id || poap.event?.id || poap.eventId);
        if (eventId && !unique.has(eventId)) {
          unique.set(eventId, {
            eventId,
            name: poap.name || poap.event?.name || 'Unknown Event',
            image: poap.image_url || poap.event?.image_url
          });
        }
      }
      return Array.from(unique.values());
    })(),

    // ERC-20s
    (async () => {
      const res = await fetch(`/api/get-filtered-tokens?address=${address}`);
      const data = await res.json();
      return (data.filteredTokens || []).map(t => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        logo: t.logo
      }));
    })()
  ]);

  return {
    address,
    nfts: nftsResult.status === 'fulfilled' ? nftsResult.value : [],
    poaps: poapsResult.status === 'fulfilled' ? poapsResult.value : [],
    erc20s: erc20sResult.status === 'fulfilled' ? erc20sResult.value : []
  };
}
```

### 3. New Helper: `computeIntersection(wallets)`

Computes the intersection of assets across all wallets, starting with the smallest set:

```javascript
function computeIntersection(wallets) {
  // Sort wallets by total asset count (smallest first)
  const sorted = [...wallets].sort((a, b) =>
    (a.nfts.length + a.poaps.length + a.erc20s.length) -
    (b.nfts.length + b.poaps.length + b.erc20s.length)
  );

  // Start with smallest wallet's assets as candidates
  let candidateNFTs = new Set(sorted[0].nfts.map(n => n.id));
  let candidatePOAPs = new Set(sorted[0].poaps.map(p => p.eventId));
  let candidateERC20s = new Set(sorted[0].erc20s.map(t => t.address.toLowerCase()));

  // Filter through remaining wallets
  for (let i = 1; i < sorted.length; i++) {
    const wallet = sorted[i];

    const walletNFTs = new Set(wallet.nfts.map(n => n.id));
    const walletPOAPs = new Set(wallet.poaps.map(p => p.eventId));
    const walletERC20s = new Set(wallet.erc20s.map(t => t.address.toLowerCase()));

    // Intersect
    candidateNFTs = new Set([...candidateNFTs].filter(x => walletNFTs.has(x)));
    candidatePOAPs = new Set([...candidatePOAPs].filter(x => walletPOAPs.has(x)));
    candidateERC20s = new Set([...candidateERC20s].filter(x => walletERC20s.has(x)));

    // Early termination if nothing left
    if (candidateNFTs.size === 0 && candidatePOAPs.size === 0 && candidateERC20s.size === 0) {
      break;
    }
  }

  // Return full objects from smallest wallet (they have the data)
  return {
    nfts: sorted[0].nfts.filter(n => candidateNFTs.has(n.id)),
    poaps: sorted[0].poaps.filter(p => candidatePOAPs.has(p.eventId)),
    erc20s: sorted[0].erc20s.filter(t => candidateERC20s.has(t.address.toLowerCase()))
  };
}
```

### 4. Progress Tracking

Simplified progress for parallel fetching:

```javascript
const findCommonAssets = async () => {
  setProgress({
    show: true,
    stage: 'Finding Common Assets',
    message: `Fetching assets for ${selectedSpirits.size} kindred spirit${selectedSpirits.size !== 1 ? 's' : ''}...`,
    isProcessing: true,
    elapsedSeconds: 0
  });

  // Parallel fetch
  const spiritAssets = await Promise.all(
    Array.from(selectedSpirits).map(fetchWalletAssets)
  );

  setProgress(prev => ({
    ...prev,
    message: 'Calculating intersection...'
  }));

  // Compute intersection...
};
```

### 5. Error Handling

Graceful degradation when individual fetches fail:

```javascript
const findCommonAssets = async () => {
  try {
    const spiritsToFetch = Array.from(selectedSpirits);

    // Parallel fetch with individual error handling
    const results = await Promise.allSettled(
      spiritsToFetch.map(fetchWalletAssets)
    );

    // Separate successes from failures
    const successfulFetches = [];
    const failedAddresses = [];

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        successfulFetches.push(result.value);
      } else {
        failedAddresses.push(spiritsToFetch[idx]);
      }
    });

    // Warn about failures but continue with what we have
    if (failedAddresses.length > 0) {
      console.warn('Failed to fetch assets for:', failedAddresses);
    }

    // Need at least 1 successful fetch to continue
    if (successfulFetches.length === 0) {
      setError('Failed to fetch assets for all selected wallets');
      return;
    }

    // Continue with successful fetches...
  } catch (err) {
    setError(err.message);
  }
};
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Spirit fetch fails | Graceful degradation — skip failed spirit, warn user |
| No common assets | Shows empty state (faster to determine now) |
| Single spirit selected | Works, much faster (no source re-fetch) |
| Source wallet not included | Same logic, exclude source from intersection |

---

## Checklist

- [ ] Extract `fetchWalletAssets()` helper function
- [ ] Extract `computeIntersection()` helper function
- [ ] Rewrite `findCommonAssets()` to use helpers
- [ ] Update progress tracking for parallel flow
- [ ] Add error handling with `Promise.allSettled`
- [ ] Test with 2 wallets (source + 1 spirit)
- [ ] Test with multiple wallets (source + 3+ spirits)
- [ ] Test error case (one spirit fails)
- [ ] Test edge case (no common assets)
- [ ] Verify build passes

## Success Criteria

- Source wallet assets never re-fetched
- Kindred spirit assets fetched in parallel
- Wall-clock time reduced by ~60-70% for typical 2-3 wallet comparisons
- Graceful handling of individual fetch failures
- All existing functionality preserved
