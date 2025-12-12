# 🔍 Common Assets Finder - Complete Logic Recap

## 🎯 Purpose
Find assets (NFTs, POAPs, ERC-20s) that are held by **ALL** selected kindred spirits (strict intersection).

---

## 📋 4-Step Workflow

### **Step 1: Fetch Assets**
**File:** `src/app/test-common-assets/page.js` → `fetchAssets()`

**What happens:**
1. User enters a wallet address
2. System fetches:
   - ERC-20 tokens via `/api/get-filtered-tokens?address=${walletAddress}`
   - NFT collections via `AlchemyMultichainClient.getCollectionsForOwner()`
   - POAP events via `PoapClient.scanAddress()`
3. Filters out POAPs from NFT collections (they come from Alchemy too)
4. Merges POAP data from both Alchemy and POAP API
5. Stores in state: `nftCollections`, `poapEvents`, `erc20Tokens`
6. Advances to Step 2

**State Updated:**
- `step = 2`
- `nftCollections = [...]`
- `poapEvents = [...]`
- `erc20Tokens = [...]`

---

### **Step 2: Select Assets for Analysis**
**File:** `src/app/test-common-assets/page.js` → UI + `toggleAsset()`

**What happens:**
1. User sees three sections: 🪙 ERC-20s, 🖼️ NFTs, 🎫 POAPs
2. User clicks checkboxes to select assets
3. Each click calls `toggleAsset(type, id)` which updates:
   - `selectedNFTs` (Set of NFT IDs)
   - `selectedPOAPs` (Set of POAP event IDs)
   - `selectedERC20s` (Set of token addresses)
4. User clicks "Find Kindred Spirits" button
5. Triggers `analyzeOverlap()`

**State Updated:**
- `selectedNFTs` = Set of selected NFT IDs
- `selectedPOAPs` = Set of selected POAP event IDs
- `selectedERC20s` = Set of selected ERC-20 addresses

---

### **Step 2.5: Analyze Overlap (Find Kindred Spirits)**
**File:** `src/app/test-common-assets/page.js` → `analyzeOverlap()`

**What happens:**
1. Converts selected IDs to full asset objects:
   ```javascript
   const nftsToAnalyze = Array.from(selectedNFTs).map(id => 
     nftCollections.find(n => n.id === id)
   ).filter(Boolean);
   // ... similar for POAPs and ERC-20s
   ```

2. Sends POST request to `/api/analyze-combined-overlap`:
   ```javascript
   body: JSON.stringify({
     walletAddress,  // ⚠️ BUG: Should be "address"
     selectedNFTs: nftsToAnalyze,  // ⚠️ BUG: Should be "nfts"
     selectedPOAPs: poapsToAnalyze,  // ⚠️ BUG: Should be "poaps"
     selectedERC20s: erc20sToAnalyze  // ⚠️ BUG: Should be "erc20s"
   })
   ```

3. API returns list of kindred spirits who share the selected assets
4. Stores in state and advances to Step 3

**API Endpoint:** `src/app/api/analyze-combined-overlap/route.js`

**API Expected Parameters:**
```javascript
const address = (body.address || '').trim().toLowerCase();  // ❌ Receiving "walletAddress"
const selectedNFTs = body.nfts || [];  // ❌ Receiving "selectedNFTs"
const selectedPOAPs = body.poaps || [];  // ❌ Receiving "selectedPOAPs"
const selectedERC20s = body.erc20s || [];  // ❌ Receiving "selectedERC20s"
```

**State Updated:**
- `step = 3`
- `kindredSpirits = [...]` (array of wallets with overlap counts)
- `analysisResults = { ... }` (full analysis data)

---

### **Step 3: Select Kindred Spirits**
**File:** `src/app/test-common-assets/page.js` → UI + `toggleSpirit()`

**What happens:**
1. User sees table of kindred spirits (wallets that share the selected assets)
2. Each row shows: checkbox, rank, wallet/ENS/Farcaster, overlap count, percentage
3. User clicks checkboxes to select 2-20 spirits
4. Each click calls `toggleSpirit(address)` which updates `selectedSpirits` Set
5. User clicks "🔍 Find Common Assets" button
6. Triggers `findCommonAssets()`

**State Updated:**
- `selectedSpirits` = Set of wallet addresses (2-20 wallets)

---

### **Step 4: Find Common Assets**
**File:** `src/app/test-common-assets/page.js` → `findCommonAssets()`

**What happens:**

#### **4a. Fetch Assets for Each Selected Wallet**
```javascript
for (const address of selectedSpirits) {
  // Fetch NFTs
  const collections = await alchemy.getCollectionsForOwner(address);
  
  // Fetch POAPs
  const poapData = await poapClient.scanAddress(address);
  
  // Fetch ERC-20s
  const erc20Response = await fetch(`/api/get-filtered-tokens?address=${address}`);
  
  // Store in walletsAssets array
  walletsAssets.push({
    address,
    nfts: [...],
    poaps: [...],
    erc20s: [...]
  });
}
```

#### **4b. Calculate Strict Intersection**

**NFT Intersection:**
```javascript
// Create Set of NFT IDs for each wallet
const nftSets = walletsAssets.map(w => new Set(w.nfts.map(nft => nft.id)));

// Find intersection (only NFTs present in ALL wallets)
const nftIntersectionIds = nftSets.reduce((acc, set) => 
  new Set([...acc].filter(x => set.has(x)))
);

// Get full NFT objects
const commonNFTs = walletsAssets[0].nfts.filter(nft => nftIntersectionIds.has(nft.id));
```

**POAP Intersection:**
```javascript
const poapSets = walletsAssets.map(w => new Set(w.poaps.map(p => p.eventId)));
const poapIntersectionIds = poapSets.reduce((acc, set) => 
  new Set([...acc].filter(x => set.has(x)))
);
const commonPOAPs = walletsAssets[0].poaps.filter(poap => poapIntersectionIds.has(poap.eventId));
```

**ERC-20 Intersection:**
```javascript
const erc20Sets = walletsAssets.map(w => new Set(w.erc20s.map(t => t.address.toLowerCase())));
const erc20IntersectionAddrs = erc20Sets.reduce((acc, set) => 
  new Set([...acc].filter(x => set.has(x)))
);
const commonERC20s = walletsAssets[0].erc20s.filter(token => 
  erc20IntersectionAddrs.has(token.address.toLowerCase())
);
```

#### **4c. Display Results**
```javascript
setCommonAssets({
  walletCount: selectedAddresses.length,
  wallets: selectedAddresses,
  totalAssets: commonNFTs.length + commonPOAPs.length + commonERC20s.length,
  nfts: commonNFTs,
  poaps: commonPOAPs,
  erc20s: commonERC20s
});
setStep(4);
```

**State Updated:**
- `step = 4`
- `commonAssets = { walletCount, wallets, totalAssets, nfts, poaps, erc20s }`

---

## 🐛 Current Bug

**Location:** Line 321-329 in `src/app/test-common-assets/page.js`

**The Problem:**
```javascript
// Current (WRONG):
body: JSON.stringify({
  walletAddress,  // ❌ API expects "address"
  selectedNFTs: nftsToAnalyze,  // ❌ API expects "nfts"
  selectedPOAPs: poapsToAnalyze,  // ❌ API expects "poaps"
  selectedERC20s: erc20sToAnalyze  // ❌ API expects "erc20s"
})
```

**API Expectation (from `src/app/api/analyze-combined-overlap/route.js`):**
```javascript
const address = (body.address || '').trim().toLowerCase();  // Line 8
const selectedNFTs = body.nfts || [];  // Line 9
const selectedPOAPs = body.poaps || [];  // Line 10
const selectedERC20s = body.erc20s || [];  // Line 11
```

**Result:**
- `address` is undefined → API returns "Missing address parameter" error
- Asset arrays are empty → Even if address worked, no analysis would happen

---

## ✅ Fix Required

**Change Line 324-328 to:**
```javascript
body: JSON.stringify({
  address: walletAddress,  // ✅ Changed from "walletAddress"
  nfts: nftsToAnalyze,  // ✅ Changed from "selectedNFTs"
  poaps: poapsToAnalyze,  // ✅ Changed from "selectedPOAPs"
  erc20s: erc20sToAnalyze  // ✅ Changed from "selectedERC20s"
})
```

---

## 📊 Data Flow Diagram

```
User enters wallet
    ↓
[Step 1: fetchAssets()]
    ↓
Stores: nftCollections, poapEvents, erc20Tokens
    ↓
User selects assets (checkboxes)
    ↓
Stores: selectedNFTs, selectedPOAPs, selectedERC20s (Sets)
    ↓
User clicks "Find Kindred Spirits"
    ↓
[Step 2: analyzeOverlap()]
    ↓
API: /api/analyze-combined-overlap
    ↓
Stores: kindredSpirits (array)
    ↓
User selects 2-20 spirits (checkboxes)
    ↓
Stores: selectedSpirits (Set)
    ↓
User clicks "Find Common Assets"
    ↓
[Step 4: findCommonAssets()]
    ↓
Fetches assets for each selected wallet
    ↓
Calculates strict intersection (Set operations)
    ↓
Stores: commonAssets { nfts, poaps, erc20s }
    ↓
Displays results
```

---

## 🔑 Key Concepts

### **Strict Intersection**
Only assets present in **100% of selected wallets** are shown. This is different from the kindred spirit analysis, which finds wallets that share **any** of the selected assets.

### **Why It's Useful**
- Identifies core assets that define a community
- Finds common ground among multiple collectors
- Reveals shared interests/attendance at same events

### **Example**
```
Wallet A: [NFT1, NFT2, NFT3, POAP1, TOKEN1]
Wallet B: [NFT2, NFT3, NFT4, POAP1, TOKEN2]
Wallet C: [NFT2, NFT5, POAP1, TOKEN1, TOKEN2]

Common Assets: [NFT2, POAP1]  ← Only these are in ALL three wallets
```

---

## 🎛️ State Management

| State Variable | Type | Purpose |
|---------------|------|---------|
| `walletAddress` | string | Original wallet to analyze |
| `step` | number (1-4) | Current workflow step |
| `loading` | boolean | Show loading state |
| `error` | string | Error messages |
| `nftCollections` | array | All NFTs owned by wallet |
| `poapEvents` | array | All POAPs owned by wallet |
| `erc20Tokens` | array | All ERC-20s owned by wallet |
| `selectedNFTs` | Set | Selected NFT IDs for analysis |
| `selectedPOAPs` | Set | Selected POAP event IDs |
| `selectedERC20s` | Set | Selected token addresses |
| `kindredSpirits` | array | Wallets with overlapping assets |
| `analysisResults` | object | Full analysis data from API |
| `selectedSpirits` | Set | Selected kindred spirit addresses |
| `commonAssets` | object | Final intersection results |
| `progress` | object | Progress bar state |

---

## 🔗 Related Files

### **Frontend**
- `src/app/test-common-assets/page.js` - Main page component

### **Backend APIs**
- `src/app/api/analyze-combined-overlap/route.js` - Kindred spirit analysis
- `src/app/api/get-filtered-tokens/route.js` - ERC-20 token fetching

### **Utilities**
- `src/app/alchemy-multichain-client.js` - NFT fetching
- `src/app/poap-client.js` - POAP fetching
- `src/app/neynar.js` - Farcaster social lookup

### **Documentation**
- `COMMON_ASSETS_FINDER_GUIDE.md` - User guide
- `COMMON_ASSETS_IMPLEMENTATION_SUMMARY.md` - Technical summary
- `TESTING_CHECKLIST_COMMON_ASSETS.md` - Testing guide

---

## 🆚 Difference from test-combined-overlap

| Feature | test-combined-overlap | test-common-assets |
|---------|----------------------|-------------------|
| **Steps** | 2 (fetch, analyze) | 4 (fetch, select, analyze, intersect) |
| **Goal** | Find kindred spirits | Find common assets |
| **Output** | List of wallets | List of assets |
| **Overlap Type** | Any match | 100% match (strict) |
| **Multi-wallet** | No | Yes (2-20 wallets) |

---

**Status:** 🐛 Bug identified - Parameter names mismatch  
**Priority:** 🔴 Critical - Blocks core functionality  
**Last Updated:** October 28, 2025

