# 🧪 Common Assets Finder - Testing Checklist

## Quick Summary
The **Common Assets Finder** is ready for testing at `/test-common-assets`

**Correct 4-Step Workflow:**
1. Fetch assets → 2. **Select assets** → 3. Find kindred spirits → 4. Find common assets

---

## ✅ Testing Checklist

### **Step 1: Fetch Assets**
- [ ] Enter wallet address: `0x1b4a302D15412655877d86ae82823D8F6d085ddD`
- [ ] Click "Fetch NFTs + POAPs + ERC-20s"
- [ ] Verify progress bar shows (3 stages)
- [ ] Confirm assets load (should see NFTs, POAPs, ERC-20s)
- [ ] Verify it moves to Step 2

### **Step 2: Select Assets**
- [ ] See three sections: 🪙 ERC-20s, 🖼️ NFTs, 🎫 POAPs
- [ ] Click to select a few assets from each category (e.g., 3-5 total)
- [ ] Verify checkboxes toggle correctly
- [ ] Verify selection counter updates
- [ ] Click "Find Kindred Spirits (X assets)" button
- [ ] Verify analysis runs with progress bar

### **Step 3: Select Kindred Spirits**
- [ ] Verify kindred spirits table displays
- [ ] See checkboxes in first column
- [ ] Click to select 2-5 spirits
- [ ] Try "Select Top 20" button
- [ ] Try "Clear All" button
- [ ] Verify selection counter shows "X selected"
- [ ] Click "🔍 Find Common Assets (X)" button
- [ ] Verify it fetches assets for selected wallets

### **Step 4: View Common Assets**
- [ ] See summary stats (wallets analyzed, total common assets)
- [ ] Verify common assets display in sections
- [ ] Check if images load for tokens/NFTs/POAPs
- [ ] Verify "100% coverage" indicator
- [ ] Click "New Analysis" to reset

---

## 🐛 Known Issues to Watch For

1. **"Missing address parameter"** - Should be fixed now
2. **Empty results** - If no common assets, should show helpful message
3. **Progress tracking** - Should show real-time updates

---

## 🎯 Expected Results

**With 2-3 spirits selected:**
- Likely to find 5-15 common assets
- Should see mix of ERC-20s, NFTs, POAPs

**With 10+ spirits selected:**
- Likely to find 0-5 common assets (strict intersection)
- May see "No common assets found" message

---

## 📊 Test Scenarios

### **Happy Path**
```
1. Wallet: 0x1b4a302D15412655877d86ae82823D8F6d085ddD
2. Select: 3 NFTs + 2 POAPs + 2 ERC-20s
3. Analyze: Should find ~20+ kindred spirits
4. Select: Top 3 spirits
5. Result: Should find 3-8 common assets
```

### **Edge Case: Many Spirits**
```
1-2. Same as above
3. Analyze: Get spirits
4. Select: 15-20 spirits
5. Result: May find 0-2 common assets (strict!)
```

### **Edge Case: Few Assets**
```
1. Wallet: (any wallet)
2. Select: Only 1 NFT
3. Analyze: May find many spirits (easier to overlap)
4. Select: 5 spirits
5. Result: Likely 0 common assets (only 1 asset to match)
```

---

## 🔍 What to Look For

### **UI/UX**
- ✅ Clear step indicators
- ✅ Progress bars work smoothly
- ✅ Buttons disabled when appropriate
- ✅ Error messages are helpful
- ✅ Images load properly

### **Functionality**
- ✅ Asset fetching works
- ✅ Selection persists between steps
- ✅ Kindred analysis uses selected assets
- ✅ Common asset calculation is correct (100% overlap)
- ✅ Reset button clears everything

### **Performance**
- ✅ Step 1: ~10-20 seconds
- ✅ Step 2: Instant
- ✅ Step 3: ~20-40 seconds
- ✅ Step 4: ~5 seconds per wallet selected

---

## 🆚 Compare with test-combined-overlap

**Similarities:**
- Steps 1-2 are identical (fetch + select)
- Uses same API endpoint for analysis

**Differences:**
- **test-combined-overlap:** Ends at showing kindred spirits
- **test-common-assets:** Adds steps 3-4 to find intersection

---

## 📝 Feedback to Provide

When testing, note:
1. Any errors or crashes
2. Confusing UI elements
3. Performance issues
4. Unexpected results
5. Feature requests

---

## 🚀 Quick Start Tomorrow

```bash
# Start dev server
npm run dev

# Navigate to
http://localhost:3000/test-common-assets

# Test wallet
0x1b4a302D15412655877d86ae82823D8F6d085ddD
```

---

## 📚 Related Files

- **Main page:** `src/app/test-common-assets/page.js`
- **User guide:** `COMMON_ASSETS_FINDER_GUIDE.md`
- **Summary:** `COMMON_ASSETS_IMPLEMENTATION_SUMMARY.md`
- **Compare with:** `src/app/test-combined-overlap/page.js`

---

**Status:** ✅ Ready for testing  
**Last Updated:** October 27, 2025  
**Version:** 2.0 (Fixed workflow)


