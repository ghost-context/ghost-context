# Common Assets Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize "Find Common Assets" to skip re-fetching source wallet assets and fetch kindred spirit assets in parallel.

**Architecture:** Extract helper functions for fetching and intersection, rewrite `findCommonAssets()` to reuse already-loaded source assets and parallelize spirit fetches.

**Tech Stack:** React, Next.js, Alchemy SDK, POAP client

---

## Task 1: Extract `fetchWalletAssets` Helper

**Files:**
- Modify: `src/app/test-common-assets/page.js:700-773` (extract into helper)

**Step 1: Add the helper function after the existing imports and before the component**

Add this function around line 87 (after `TestSocialCard` component, before `TestCommonAssetsPage`):

```javascript
// Helper: Fetch all assets for a wallet in parallel
async function fetchWalletAssets(address) {
  const { AlchemyMultichainClient } = await import('./alchemy-multichain-client');
  const { PoapClient } = await import('./poap-client');

  const alchemy = new AlchemyMultichainClient();
  const poapClient = new PoapClient();

  const [nftsResult, poapsResult, erc20sResult] = await Promise.allSettled([
    // NFTs
    (async () => {
      try {
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
      } catch (err) {
        console.warn(`Failed to fetch NFTs for ${address}:`, err.message);
        return [];
      }
    })(),

    // POAPs
    (async () => {
      try {
        const poapData = await poapClient.scanAddress(address);
        const poaps = poapData?.events || poapData?.poaps || [];
        const unique = new Map();
        for (const poap of poaps) {
          const eventId = String(poap.id || poap.event?.id || poap.eventId);
          if (eventId && !unique.has(eventId)) {
            unique.set(eventId, {
              eventId,
              name: poap.name || poap.event?.name || 'Unknown Event',
              image: poap.image_url || poap.event?.image_url || poap.imageUrl
            });
          }
        }
        return Array.from(unique.values());
      } catch (err) {
        console.warn(`Failed to fetch POAPs for ${address}:`, err.message);
        return [];
      }
    })(),

    // ERC-20s
    (async () => {
      try {
        const res = await fetch(`/api/get-filtered-tokens?address=${address}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.filteredTokens || []).map(t => ({
          address: t.address,
          symbol: t.symbol,
          name: t.name,
          logo: t.logo,
          holderCount: t.holderCount
        }));
      } catch (err) {
        console.warn(`Failed to fetch ERC-20s for ${address}:`, err.message);
        return [];
      }
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

**Step 2: Verify no syntax errors**

Run: `npm run build`
Expected: Build succeeds (helper not yet used)

**Step 3: Commit**

```bash
git add src/app/test-common-assets/page.js
git commit -m "feat: add fetchWalletAssets helper for parallel asset fetching"
```

---

## Task 2: Extract `computeIntersection` Helper

**Files:**
- Modify: `src/app/test-common-assets/page.js` (add helper after `fetchWalletAssets`)

**Step 1: Add the intersection helper function**

Add this function right after `fetchWalletAssets`:

```javascript
// Helper: Compute intersection of assets across multiple wallets
function computeIntersection(wallets) {
  if (wallets.length === 0) {
    return { nfts: [], poaps: [], erc20s: [] };
  }

  if (wallets.length === 1) {
    return {
      nfts: wallets[0].nfts,
      poaps: wallets[0].poaps,
      erc20s: wallets[0].erc20s
    };
  }

  // Sort wallets by total asset count (smallest first for efficiency)
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

    // Intersect each asset type
    candidateNFTs = new Set([...candidateNFTs].filter(x => walletNFTs.has(x)));
    candidatePOAPs = new Set([...candidatePOAPs].filter(x => walletPOAPs.has(x)));
    candidateERC20s = new Set([...candidateERC20s].filter(x => walletERC20s.has(x)));

    // Early termination if nothing left
    if (candidateNFTs.size === 0 && candidatePOAPs.size === 0 && candidateERC20s.size === 0) {
      break;
    }
  }

  // Return full objects from smallest wallet (preserves metadata)
  return {
    nfts: sorted[0].nfts.filter(n => candidateNFTs.has(n.id)),
    poaps: sorted[0].poaps.filter(p => candidatePOAPs.has(p.eventId)),
    erc20s: sorted[0].erc20s.filter(t => candidateERC20s.has(t.address.toLowerCase()))
  };
}
```

**Step 2: Verify no syntax errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/test-common-assets/page.js
git commit -m "feat: add computeIntersection helper with smallest-first optimization"
```

---

## Task 3: Rewrite `findCommonAssets` Function

**Files:**
- Modify: `src/app/test-common-assets/page.js:661-926` (replace `findCommonAssets` function)

**Step 1: Replace the entire `findCommonAssets` function**

Find the existing function (starts around line 661) and replace it entirely with:

```javascript
  // Step 3: Find common assets among selected spirits
  const findCommonAssets = async () => {
    // Determine minimum required selections based on includeSourceWallet
    const minRequired = includeSourceWallet ? 1 : 2;

    if (selectedSpirits.size < minRequired) {
      setError(`Please select at least ${minRequired} wallet${minRequired > 1 ? 's' : ''}`);
      return;
    }

    setLoading(true);
    setError('');
    setCommonAssets(null);

    const spiritsToFetch = Array.from(selectedSpirits);
    const totalWallets = includeSourceWallet ? spiritsToFetch.length + 1 : spiritsToFetch.length;

    setProgress({
      show: true,
      stage: 'Finding Common Assets',
      current: 0,
      total: 1,
      message: `Fetching assets for ${spiritsToFetch.length} kindred spirit${spiritsToFetch.length !== 1 ? 's' : ''}...`,
      isProcessing: true,
      elapsedSeconds: 0
    });

    try {
      // Fetch all kindred spirits' assets in PARALLEL
      const results = await Promise.allSettled(
        spiritsToFetch.map(address => fetchWalletAssets(address))
      );

      // Separate successes from failures
      const successfulFetches = [];
      const failedAddresses = [];

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successfulFetches.push(result.value);
        } else {
          failedAddresses.push(spiritsToFetch[idx]);
          console.warn(`Failed to fetch assets for ${spiritsToFetch[idx]}:`, result.reason);
        }
      });

      // Warn about failures
      if (failedAddresses.length > 0) {
        console.warn('Failed to fetch assets for wallets:', failedAddresses);
      }

      // Need at least 1 successful fetch (or source wallet if included)
      if (successfulFetches.length === 0 && !includeSourceWallet) {
        setError('Failed to fetch assets for all selected wallets');
        setLoading(false);
        setProgress({ show: false, stage: '', current: 0, total: 0, message: '', isProcessing: false, elapsedSeconds: 0 });
        return;
      }

      setProgress(prev => ({
        ...prev,
        message: 'Calculating intersection...'
      }));

      // Build wallet list for intersection
      // Source wallet uses ALREADY LOADED assets (no re-fetch!)
      const allWallets = [];

      if (includeSourceWallet) {
        allWallets.push({
          address: walletAddress,
          nfts: nftCollections.map(nft => ({
            id: nft.id,
            address: nft.address,
            network: nft.network,
            name: nft.name,
            image: nft.image
          })),
          poaps: poapEvents.map(poap => ({
            eventId: poap.eventId,
            name: poap.name,
            image: poap.image
          })),
          erc20s: erc20Tokens.map(token => ({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            logo: token.logo,
            holderCount: token.holderCount
          }))
        });
      }

      allWallets.push(...successfulFetches);

      // Debug logging
      console.log('🔍 Common Assets Analysis - Wallets to intersect:');
      allWallets.forEach((wallet, idx) => {
        console.log(`Wallet ${idx + 1} (${wallet.address.slice(0, 8)}...):`, {
          nfts: wallet.nfts.length,
          poaps: wallet.poaps.length,
          erc20s: wallet.erc20s.length
        });
      });

      // Compute intersection using helper
      const common = computeIntersection(allWallets);

      console.log('✅ Common Assets Found:', {
        nfts: common.nfts.length,
        poaps: common.poaps.length,
        erc20s: common.erc20s.length
      });

      // Calculate totals for display
      const totalNFTsAnalyzed = allWallets.reduce((sum, w) => sum + w.nfts.length, 0);
      const totalPOAPsAnalyzed = allWallets.reduce((sum, w) => sum + w.poaps.length, 0);
      const totalERC20sAnalyzed = allWallets.reduce((sum, w) => sum + w.erc20s.length, 0);

      setCommonAssets({
        walletCount: allWallets.length,
        wallets: allWallets.map(w => w.address),
        totalAssets: common.nfts.length + common.poaps.length + common.erc20s.length,
        totalAssetsAnalyzed: totalNFTsAnalyzed + totalPOAPsAnalyzed + totalERC20sAnalyzed,
        totalNFTsAnalyzed,
        totalPOAPsAnalyzed,
        totalERC20sAnalyzed,
        nfts: common.nfts,
        poaps: common.poaps,
        erc20s: common.erc20s
      });

      setStep(4);
    } catch (err) {
      console.error('Error in findCommonAssets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress({ show: false, stage: '', current: 0, total: 0, message: '', isProcessing: false, elapsedSeconds: 0 });
    }
  };
```

**Step 2: Remove unused imports if any**

Check if `AlchemyMultichainClient` and `PoapClient` are still imported at the top of the file. They should be, as they're used by `fetchAssets` and other functions. The new helper uses dynamic imports, but the existing code still needs the static imports.

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/test-common-assets/page.js
git commit -m "feat: rewrite findCommonAssets to reuse source assets and parallelize fetches"
```

---

## Task 4: Manual Testing

**Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

**Step 2: Test basic flow (2 wallets)**

1. Visit: http://localhost:3000/test-common-assets
2. Enter: `0x1b4a302D15412655877d86ae82823D8F6d085ddD`
3. Click "Fetch NFTs + POAPs + ERC-20s"
4. Select 2 ERC-20 tokens (BLONDE and CD)
5. Click "Find Kindred Spirits"
6. Select 1 kindred spirit (e.g., ldf.eth)
7. Ensure "Include source wallet" is checked
8. Click "Find Common Assets"

Expected:
- Progress shows "Fetching assets for 1 kindred spirit..."
- Results appear faster than before
- Console shows debug logging with wallet asset counts

**Step 3: Test multiple wallets (4 wallets)**

1. Go back to Step 3
2. Select 3 kindred spirits
3. Click "Find Common Assets"

Expected:
- Progress shows "Fetching assets for 3 kindred spirits..."
- All 3 fetched in parallel (check Network tab)
- Results show intersection of all 4 wallets

**Step 4: Test without source wallet**

1. Go back to Step 3
2. Uncheck "Include source wallet"
3. Select 2 kindred spirits
4. Click "Find Common Assets"

Expected:
- Only compares the 2 selected spirits
- Source wallet not included in intersection

**Step 5: Test error handling**

1. Open browser dev tools
2. Go to Network tab
3. Throttle to "Offline" briefly during a fetch
4. Observe graceful error handling

Expected:
- Failed fetches logged to console
- Operation continues with successful fetches

**Step 6: Commit if all tests pass**

```bash
git add -A
git commit -m "test: verify common assets optimization works correctly"
```

---

## Task 5: Remove Dead Code (Optional Cleanup)

**Files:**
- Modify: `src/app/test-common-assets/page.js`

**Step 1: Review the old `findCommonAssets` code**

The new implementation is complete. The old sequential fetching code within the function has been replaced. No additional cleanup needed unless there are orphaned helper functions.

**Step 2: Verify no unused variables**

Run: `npm run lint`
Expected: No unused variable warnings related to our changes

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: clean up common assets optimization"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Extract `fetchWalletAssets` helper | 20 min |
| 2 | Extract `computeIntersection` helper | 15 min |
| 3 | Rewrite `findCommonAssets` | 30 min |
| 4 | Manual testing | 45 min |
| 5 | Cleanup (optional) | 10 min |
| **Total** | | **~2 hours** |

## Success Criteria

- [ ] Source wallet assets never re-fetched (reuses Step 1 data)
- [ ] Kindred spirit assets fetched in parallel
- [ ] "Include source wallet" toggle still works
- [ ] Error handling gracefully degrades on fetch failures
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] All manual tests pass
