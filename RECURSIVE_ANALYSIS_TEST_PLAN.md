# 🧪 Recursive Analysis - Quick Test Plan

## 🎯 Quick Start

**URL:** `http://localhost:3000/test-common-assets`  
**Prerequisites:** Moralis Starter Plan (API credits)  
**Time:** ~5-10 minutes per test

---

## ✅ Test 1: Basic Recursion (PRIORITY)

### **Goal:** Verify the recursive loop works end-to-end

### **Steps:**
1. Enter wallet: `0x1b4a302d15412655877d86ae82823d8f6d085ddd`
2. Click "Fetch NFTs + POAPs + ERC-20s"
3. Wait for assets to load (progress bar should show)
4. Select 2-3 assets (any type)
5. Click "Analyze Selected Assets"
6. Wait for kindred spirits to appear
7. Select 3-5 kindred spirits
8. Click "Find Common Assets"
9. Wait for common assets to appear
10. ⭐ **NEW:** Select 1-2 common assets (click cards or checkboxes)
11. ⭐ **NEW:** Verify button shows "🔄 Find New Kindred Spirits (X selected)"
12. ⭐ **NEW:** Click the button
13. ⭐ **NEW:** Verify new kindred spirits table appears (Step 3)
14. Repeat from step 7 (can recurse again!)

### **Expected Results:**
- ✅ Button shows selection count
- ✅ Button is purple and clickable when 1+ selected
- ✅ Progress bar shows during analysis
- ✅ New kindred spirits appear (different from before)
- ✅ Can select spirits and find common assets again
- ✅ Can recurse 3+ times without errors

### **Pass/Fail:**
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## ✅ Test 2: Search Functionality

### **Goal:** Verify search bars filter correctly

### **Steps:**
1. Complete Test 1 up to step 9 (have common assets showing)
2. In **ERC-20 section:**
   - Type "USD" in search bar
   - Verify only tokens with "USD" in name/symbol show
   - Verify count shows "(X / Total)"
   - Clear search
   - Verify all tokens reappear
3. In **NFT section:**
   - Type "Punk" in search bar
   - Verify only collections with "Punk" in name show
   - Verify count updates
4. In **POAP section:**
   - Type "ETH" in search bar
   - Verify only events with "ETH" in name show
   - Verify count updates

### **Expected Results:**
- ✅ Search filters instantly (no delay)
- ✅ Count shows "(filtered / total)"
- ✅ Clearing search restores all items
- ✅ Selected items stay selected after search

### **Pass/Fail:**
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## ✅ Test 3: Selection UI/UX

### **Goal:** Verify visual feedback and interactions

### **Steps:**
1. In Step 4 (common assets), observe an unselected card:
   - Background should be gray (`bg-gray-700`)
   - Border should be transparent
   - Checkbox should be unchecked
2. Click the card (anywhere):
   - Background should become purple (`bg-purple-900/30`)
   - Border should become purple (`border-purple-500`)
   - Checkbox should be checked
   - Button count should increment
3. Click the checkbox directly:
   - Should toggle selection
   - Visual feedback should update
4. Click the card again:
   - Should deselect (back to gray)
   - Button count should decrement
5. Hover over unselected card:
   - Should show hover effect (`bg-gray-600`)

### **Expected Results:**
- ✅ Cards have smooth visual transitions
- ✅ Purple border on selected items
- ✅ Checkboxes sync with selection state
- ✅ Button count updates in real-time
- ✅ Hover effects work properly

### **Pass/Fail:**
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## ✅ Test 4: Multi-Level Recursion

### **Goal:** Verify can recurse 3+ times without issues

### **Steps:**
1. Complete Test 1 to get to Step 3 (kindred spirits)
2. Select 3 spirits → Find common assets
3. **Iteration 1:** Select 2 common assets → Find new spirits
4. **Iteration 2:** Select 2 spirits → Find common assets
5. **Iteration 3:** Select 1 common asset → Find new spirits
6. **Iteration 4:** Select 2 spirits → Find common assets
7. Continue until spirits count < 10 or no common assets

### **Expected Results:**
- ✅ Each iteration works without errors
- ✅ Spirit count decreases over iterations (normal)
- ✅ Common asset count decreases (normal)
- ✅ Progress bar shows on each iteration
- ✅ No memory leaks (page doesn't slow down)

### **Pass/Fail:**
- [ ] PASS (reached level _____)
- [ ] FAIL (describe issue): _______________

---

## ✅ Test 5: Edge Cases

### **Goal:** Verify error handling and edge cases

### **Steps:**

#### **5A: No Selection**
1. In Step 4, select 0 common assets
2. Verify button is disabled (gray, cursor-not-allowed)
3. Try clicking it (should do nothing)

#### **5B: Single Selection**
1. Select exactly 1 common asset
2. Verify button is enabled
3. Click button
4. Verify analysis runs

#### **5C: No Spirits Found**
1. Select a very rare common asset (if available)
2. Click button
3. Verify error message shows if 0 spirits found

#### **5D: New Analysis Reset**
1. In Step 4 with selections made
2. Click "New Analysis" button
3. Verify everything resets to Step 1
4. Verify selections are cleared

### **Expected Results:**
- ✅ Button disables with 0 selections
- ✅ Works with 1 selection
- ✅ Error message for 0 spirits
- ✅ "New Analysis" clears everything

### **Pass/Fail:**
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## ✅ Test 6: Cross-Type Selection

### **Goal:** Verify can select from multiple asset types

### **Steps:**
1. In Step 4, select:
   - 2 ERC-20 tokens
   - 1 NFT collection
   - 1 POAP event
2. Verify button shows "(4 selected)"
3. Click "Find New Kindred Spirits"
4. Open browser console (F12)
5. Check network tab for API call
6. Verify all 4 assets are in request body

### **Expected Results:**
- ✅ Can select across all 3 types
- ✅ Button counts all types together
- ✅ API receives all selected assets
- ✅ Analysis uses all types

### **Pass/Fail:**
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## ✅ Test 7: Performance & Responsiveness

### **Goal:** Verify UI remains responsive during long operations

### **Steps:**
1. Select 10+ common assets (if available)
2. Click "Find New Kindred Spirits"
3. Observe during analysis:
   - Progress bar animates
   - Timer counts up
   - UI doesn't freeze
   - Can't click button again (disabled)
4. Wait for completion
5. Verify results appear correctly

### **Expected Results:**
- ✅ Progress bar shows activity
- ✅ Timer updates every second
- ✅ UI remains responsive (no freeze)
- ✅ Button disables during processing
- ✅ Results appear after completion

### **Pass/Fail:**
- [ ] PASS
- [ ] FAIL (describe issue): _______________

---

## 🐛 Bug Reporting Template

If any test fails, use this template:

```
**Test:** [Test Name]
**Step:** [Which step failed]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Console Errors:** [Any errors in browser console]
**Screenshot:** [If applicable]
**Browser:** [Chrome/Firefox/Safari/etc.]
**OS:** [macOS/Windows/Linux]
```

---

## 📊 Test Summary

Fill this out after completing all tests:

```
✅ Test 1 (Basic Recursion):       [ ] Pass  [ ] Fail
✅ Test 2 (Search):                 [ ] Pass  [ ] Fail
✅ Test 3 (Selection UI):           [ ] Pass  [ ] Fail
✅ Test 4 (Multi-Level):            [ ] Pass  [ ] Fail
✅ Test 5 (Edge Cases):             [ ] Pass  [ ] Fail
✅ Test 6 (Cross-Type):             [ ] Pass  [ ] Fail
✅ Test 7 (Performance):            [ ] Pass  [ ] Fail

Overall Status: [ ] ALL PASS  [ ] NEEDS FIXES
```

---

## 🎯 Priority Order

If time is limited, test in this order:

1. **Test 1** (Basic Recursion) - CRITICAL
2. **Test 3** (Selection UI) - HIGH
3. **Test 5** (Edge Cases) - HIGH
4. **Test 2** (Search) - MEDIUM
5. **Test 4** (Multi-Level) - MEDIUM
6. **Test 6** (Cross-Type) - LOW
7. **Test 7** (Performance) - LOW

---

## 🚀 Quick Debug Checklist

If something doesn't work:

1. **Check console** (F12) for JavaScript errors
2. **Check network tab** for failed API calls
3. **Verify server is running** (`localhost:3000`)
4. **Check Moralis credits** (might be depleted)
5. **Clear browser cache** (hard refresh: Cmd+Shift+R)
6. **Try different wallet address** (might have no assets)

---

## 📞 Support

If you encounter issues:

1. **Check documentation:**
   - `RECURSIVE_ANALYSIS_GUIDE.md` (technical details)
   - `RECURSIVE_ANALYSIS_UI_DEMO.md` (UI screenshots)
   - `RECURSIVE_ANALYSIS_SUMMARY.md` (overview)

2. **Debug mode:**
   - Open browser console (F12)
   - Look for red errors
   - Check network tab for 400/500 responses

3. **Common issues:**
   - "Missing address parameter" → Check wallet address format
   - "No kindred spirits found" → Try different assets
   - "Rate limit exceeded" → Moralis credits depleted
   - Button won't enable → Make sure 1+ assets selected

---

**Happy Testing! 🎉**

Report back with results and we'll iterate as needed! 🚀

