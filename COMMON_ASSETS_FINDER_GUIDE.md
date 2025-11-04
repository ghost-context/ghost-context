# 🔍 Common Assets Finder - User Guide

## Overview
The Common Assets Finder extends the kindred spirit analysis by identifying assets shared by **multiple** selected wallets. This helps discover the "core identity" of a community or collector group.

**Access:** Navigate to `/test-common-assets` in your browser

---

## 🎯 What Problem Does This Solve?

### Traditional Kindred Spirit Analysis:
- **Input:** 1 wallet
- **Output:** Other wallets that share assets with that wallet
- **Question Answered:** "Who else likes what I like?"

### Common Assets Finder:
- **Input:** Multiple wallets (from kindred spirit results)
- **Output:** Assets that ALL selected wallets hold
- **Question Answered:** "What defines this group? What do they all have in common?"

---

## 📋 Three-Step Workflow

### **Step 1: Find Kindred Spirits**
1. Enter a wallet address
2. System automatically fetches ALL assets (NFTs, POAPs, ERC-20s)
3. Runs kindred spirit analysis
4. Displays ranked list of wallets with shared assets

**Unlike test-combined-overlap:** You don't manually select assets—the system analyzes everything automatically.

### **Step 2: Select Kindred Spirits**
1. Review the kindred spirits list
2. Select 2-20 wallets using checkboxes
3. Click "🔍 Find Common Assets (X)"

**Features:**
- Click any row to toggle selection
- "Select Top 20" button for quick selection
- "Clear All" to start over
- Shows current selection count
- Maximum 20 wallets enforced

### **Step 3: View Common Assets**
1. System fetches assets for all selected wallets
2. Calculates strict intersection (100% coverage)
3. Displays only assets held by ALL selected wallets

**Results Include:**
- Summary statistics
- 🪙 ERC-20 tokens common to all
- 🖼️ NFT collections common to all
- 🎫 POAP events common to all

---

## 🔧 Technical Details

### **Strict Intersection Algorithm**

```javascript
// For each asset type, find items present in ALL wallets
const nftSets = walletsAssets.map(w => new Set(w.nfts.map(nft => nft.id)));
const commonNFTs = nftSets.reduce((acc, set) => 
  new Set([...acc].filter(x => set.has(x)))
);
```

**Matching Logic:**
- **NFTs:** Match by `network + contract_address` (e.g., "ETH_MAINNET-0x123...")
- **POAPs:** Match by `eventId` (e.g., "129461")
- **ERC-20s:** Match by token `address` (case-insensitive)

### **Performance**

**API Calls Per Analysis:**
- Step 1 (Initial wallet): 3 calls (NFTs + POAPs + ERC-20s)
- Step 1 (Analysis): N calls (where N = total assets)
- Step 3 (Common assets): Selected wallets × 3

**Example:** Selecting 10 wallets = 30 additional API calls

**Optimization:**
- Parallel fetching using `Promise.all`
- Progress bar tracks all API calls
- Error handling: Failed fetches don't block analysis

---

## 📊 UI Design

### **Step 2: Selection Table**
```
┌───┬────┬──────────────────────┬──────────┬─────┐
│ ☑ │ #  │ Wallet/ENS/Farcaster │ Overlaps │  %  │
├───┼────┼──────────────────────┼──────────┼─────┤
│ ☑ │ #1 │ vitalik.eth          │    15    │ 75% │
│ ☑ │ #2 │ 0x1234...5678        │    12    │ 60% │
│ ☐ │ #3 │ hayden.eth           │    10    │ 50% │
└───┴────┴──────────────────────┴──────────┴─────┘

[Select Top 20] [Clear All]    [🔍 Find Common Assets (2)]
```

### **Step 3: Results**
```
┌─────────────────────────────────────────────────┐
│ 📊 Common Assets Results                        │
├─────────────────────────────────────────────────┤
│ Wallets: 5  |  Total: 12  |  🖼️7 🎫3 🪙2  │100% │
├─────────────────────────────────────────────────┤
│ 🪙 ERC-20 Tokens (2)                            │
│   • Held by all 5 wallets                       │
│                                                  │
│ [USDC Icon] USDC - USD Coin                    │
│ [DAI Icon]  DAI - Dai Stablecoin               │
│                                                  │
├─────────────────────────────────────────────────┤
│ 🖼️ NFT Collections (7)                          │
│   • Held by all 5 wallets                       │
│                                                  │
│ [BAYC] Bored Ape Yacht Club (Ethereum)         │
│ [Azuki] Azuki (Ethereum)                        │
│ ... (5 more)                                     │
│                                                  │
├─────────────────────────────────────────────────┤
│ 🎫 POAP Events (3)                              │
│   • Held by all 5 wallets                       │
│                                                  │
│ [POAP] ETHDenver 2023                          │
│ [POAP] DevCon VI                                │
│ [POAP] NFT.NYC 2023                            │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Use Cases

### **1. Community Definition**
**Question:** "What assets define core members of this NFT community?"

**Flow:**
1. Enter a known community leader's wallet
2. Find their kindred spirits (top collectors)
3. Select top 10 spirits
4. View common assets = community "identity markers"

**Example:** Analyzing top 10 Bored Ape collectors might reveal they all hold:
- BAYC (obviously)
- Mutant Ape Yacht Club
- Otherdeed for Otherside
- ApeCoin (APE)
- Specific POAPs from community events

### **2. Investment Research**
**Question:** "What do successful crypto VCs all hold?"

**Flow:**
1. Enter a known VC wallet (e.g., a16z)
2. Find similar sophisticated investors
3. Select 15-20 wallets
4. Common assets = high-conviction plays

**Insight:** Assets held by ALL top VCs likely represent consensus opportunities.

### **3. Curator Validation**
**Question:** "Which NFT collections have universal respect among top curators?"

**Flow:**
1. Start with a respected curator
2. Find other high-taste collectors
3. Select 10 curators
4. Common NFTs = universally respected collections

### **4. Tribe Discovery**
**Question:** "What's the shared identity of this group?"

**Flow:**
1. Start with any group member
2. Find their kindred spirits
3. Select all spirits (up to 20)
4. Common assets reveal tribe markers

**Example:** A group all holding specific POAPs + DAOs + NFTs = shared community identity.

---

## 📉 Intersection Math

### **The More Wallets, The Fewer Common Assets**

```
2 wallets:  ~20-50 common assets (relatively easy to overlap)
5 wallets:  ~5-15 common assets  (moderate overlap)
10 wallets: ~2-8 common assets   (strict overlap)
20 wallets: ~0-3 common assets   (very rare to overlap)
```

**Why?**
- Each wallet adds a filter: "Must be present here too"
- Probability of overlap decreases exponentially
- 100% coverage is strict requirement

### **Strategy:**
- **Start small:** 2-5 wallets for broad insights
- **Scale up:** Add more wallets to narrow down to "core" assets
- **Watch the count:** If common assets = 0, reduce selection size

---

## ⚠️ Important Considerations

### **1. Strict Intersection = High Bar**
- **100% coverage required:** Asset must be in EVERY selected wallet
- **No flexibility:** Even 19/20 wallets doesn't count
- **Trade-off:** Precision vs. coverage

### **2. Performance Limits**
- **Max 20 wallets:** Enforced for performance + API limits
- **~60 API calls** for 20 wallets (3 per wallet)
- **Takes time:** ~30-60 seconds for full analysis

### **3. Asset Fetching Scope**
- **Only filtered tokens:** ERC-20s must have 100+ holders (from Moralis)
- **"Relevant" NFTs:** Low-quality/spam collections filtered by Alchemy
- **Active POAPs:** Only POAPs associated with the wallet address

### **4. No Results Scenario**
If common assets = 0:
- Wallets are too diverse
- No universal holdings
- **Solution:** Select fewer wallets or different spirits

---

## 🆚 Comparison: test-combined-overlap vs. test-common-assets

| Feature | test-combined-overlap | test-common-assets |
|---------|----------------------|-------------------|
| **Primary Goal** | Find wallets like yours | Find assets shared by group |
| **Input** | 1 wallet + manual asset selection | 1 wallet (auto) → multiple spirits |
| **Asset Selection** | Manual (user picks) | Automatic (all assets) |
| **Output** | List of kindred spirits | Common assets list |
| **Analysis Type** | 1-to-many | Many-to-intersection |
| **Workflow** | 2 steps | 3 steps |
| **Use Case** | Discovery | Definition |

---

## 🚀 Advanced Tips

### **Tip 1: Start Broad, Then Narrow**
1. Run with 2-3 wallets first
2. Review common assets
3. Add more wallets to filter to "core" assets

### **Tip 2: Use Overlap % as Selection Criteria**
- High overlap % (70%+) = Similar tastes → Likely to share more
- Select high % spirits for better common asset results

### **Tip 3: Compare Different Groups**
- Run analysis on top 5 spirits
- Note common assets
- Run again on different 5 spirits
- Compare results to find group differences

### **Tip 4: Export Pattern**
- Take note of common assets
- Research why these assets are universally held
- Use as investment/collection thesis

---

## 📝 Example Walkthrough

### **Scenario: Defining the "Blue Chip NFT Collector" Profile**

**Goal:** Find what assets ALL top blue chip collectors hold

**Step 1: Find Base Wallet**
```
Input: 0x1b4a302D15412655877d86ae82823D8F6d085ddD
Output: 43 kindred spirits found
```

**Step 2: Select Top 10**
```
Selected:
- #1: vitalik.eth (87% overlap, 15 shared assets)
- #2: 0xabc...def (82% overlap, 14 shared assets)
- #3: pranksy.eth (78% overlap, 13 shared assets)
... (7 more)
```

**Step 3: Common Assets**
```
Wallets Analyzed: 10
Total Common Assets: 6

🪙 ERC-20 Tokens (2):
  • USDC - USD Coin
  • WETH - Wrapped Ether

🖼️ NFT Collections (3):
  • CryptoPunks (Ethereum)
  • Bored Ape Yacht Club (Ethereum)
  • Art Blocks Curated (Ethereum)

🎫 POAP Events (1):
  • NFT.NYC 2023
```

**Insights:**
- **Stablecoins:** All hold USDC (liquidity for buying)
- **WETH:** Ready to purchase on any marketplace
- **Blue Chips:** CryptoPunks + BAYC = table stakes
- **Art:** Art Blocks = appreciation for generative art
- **Events:** NFT.NYC attendance = active community participation

**Conclusion:** To be a "blue chip collector," you need:
1. Capital ready (USDC/WETH)
2. Foundational NFTs (Punks/BAYC)
3. Art appreciation (Art Blocks)
4. Community engagement (IRL events)

---

## 🔮 Future Enhancements (Not Implemented)

- [ ] **Flexible threshold:** Show assets held by 80%+ of wallets
- [ ] **Tiered results:** 100% / 80% / 60% coverage
- [ ] **Historical analysis:** Common assets over time
- [ ] **Export results:** Download as CSV/JSON
- [ ] **Save analysis:** Bookmark for later reference
- [ ] **Direct input:** Paste multiple addresses directly
- [ ] **Visual Venn diagram:** Show overlap visually
- [ ] **Asset insights:** Why these assets matter

---

## 🐛 Troubleshooting

### **"No kindred spirits found"**
- **Cause:** Wallet has very few assets or very unique assets
- **Solution:** Try a different wallet with more mainstream holdings

### **"No common assets found"**
- **Cause:** Selected wallets are too diverse
- **Solution:** Select fewer wallets (2-5) or spirits with higher overlap %

### **"Maximum 20 wallets can be selected"**
- **Cause:** Trying to select more than 20
- **Solution:** Deselect some wallets. 20 is performance limit.

### **Analysis taking too long**
- **Cause:** Fetching assets for 20 wallets = many API calls
- **Solution:** This is normal. Wait ~60 seconds. Progress bar shows status.

### **Some wallets show 0 assets in common despite high overlap**
- **Cause:** They shared assets with original wallet, but not with each other
- **Solution:** This is expected. Common assets finder requires ALL to share.

---

## 📚 Related Documentation

- `CROSS_TYPE_OVERLAP_EXPLAINED.md` - Core kindred spirit analysis logic
- `UI_ENHANCEMENTS_GUIDE.md` - UI features (search, owner counts, etc.)
- `TEST_TOMORROW_GUIDE.md` - Comprehensive testing guide

---

## ✅ Testing Checklist

- [ ] Step 1: Initial wallet analysis completes successfully
- [ ] Kindred spirits list displays with checkboxes
- [ ] Can select/deselect individual wallets
- [ ] "Select Top 20" button works
- [ ] "Clear All" button works
- [ ] Selection counter updates correctly
- [ ] Maximum 20 wallet enforcement works
- [ ] Step 3: Common assets analysis completes
- [ ] Results show correct counts
- [ ] All three asset types display properly
- [ ] Images load for tokens/NFTs/POAPs
- [ ] "No common assets" message shows when applicable
- [ ] "New Analysis" button resets properly
- [ ] Progress bar tracks all stages
- [ ] Error handling works for failed API calls

---

**Last Updated:** October 27, 2025  
**Version:** 1.0 - Initial Release  
**Page:** `/test-common-assets`

