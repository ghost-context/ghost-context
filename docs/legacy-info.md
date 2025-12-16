# Legacy Documentation - Common Assets Finder

This document consolidates historical development notes for the Common Assets Finder feature.

## Feature Overview

**Location:** `/test-common-assets`

**Purpose:** Find assets (NFTs, POAPs, ERC-20s) held by ALL selected kindred spirits using strict intersection (100% coverage required).

**Workflow:**
1. Enter wallet address → fetch all assets
2. Select assets for analysis
3. Find kindred spirits (wallets sharing selected assets)
4. Select 2-20 spirits → find common assets

## Technical Details

### Intersection Algorithm

Assets must be present in ALL selected wallets to appear in results:

```javascript
// Create Sets per wallet, reduce to intersection
const nftSets = walletsAssets.map(w => new Set(w.nfts.map(nft => nft.id)));
const commonIds = nftSets.reduce((acc, set) =>
  new Set([...acc].filter(x => set.has(x)))
);
```

### Asset Matching Keys
- **NFTs:** `network + contract_address` (e.g., "ETH_MAINNET-0x123...")
- **POAPs:** `eventId` (string)
- **ERC-20s:** Token `address` (case-insensitive)

### ERC-20 Filtering
Only Base mainnet tokens with 2-10,000 holders are included. Configured in `/api/get-filtered-tokens/route.js`:
```javascript
const chains = ['0x2105', '8453', 'base'];
const minHolders = 2;
const maxHolders = 10000;
```

## Bug Fixes Applied

### POAP Data Structure
The POAP API returns `events` (not `poaps`) with flat structure:
```javascript
// Correct:
const poaps = poapData?.events || poapData?.poaps || [];
const eventId = poap.id || poap.event?.id;
const name = poap.name || poap.event?.name;
const image = poap.image_url || poap.event?.image_url;
```

### API Parameter Names
The `/api/analyze-combined-overlap` endpoint expects:
```javascript
{ address, nfts, poaps, erc20s }  // NOT walletAddress, selectedNFTs, etc.
```

## UI Features

- **Search bars:** Filter assets by name/symbol in real-time
- **Bulk selection:** Select All / Clear buttons (respects search filters)
- **Owner counts:** Display holder/owner counts for all asset types
- **Token badges:** ERC721 (blue) / ERC1155 (purple) indicators
- **Progress tracking:** Real-time progress bars during analysis

## Constraints

- **Max 20 wallets** for common assets analysis
- **150k holder limit** per collection in kindred spirit analysis
- **Top 100 results** returned from kindred spirit analysis
- **Minimum 2 overlaps** required when analyzing 2+ assets

## Intersection Math

More wallets = fewer common assets (exponential decrease):
- 2-3 wallets: ~20-50 common assets
- 5 wallets: ~5-15 common assets
- 10 wallets: ~2-8 common assets
- 20 wallets: ~0-3 common assets

## Related Files

- `src/app/test-common-assets/page.js` - Main component
- `src/app/api/analyze-combined-overlap/route.js` - Analysis endpoint
- `src/app/api/get-filtered-tokens/route.js` - ERC-20 fetching
- `src/app/alchemy-multichain-client.js` - NFT fetching
- `src/app/poap-client.js` - POAP fetching
