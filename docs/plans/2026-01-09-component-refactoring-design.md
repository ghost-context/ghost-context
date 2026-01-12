# Component Refactoring Design
*Created: 2026-01-09*

## Overview

Split large components into smaller, testable units. Extract business logic into custom hooks. Consolidate duplicate dependencies.

**Estimated time:** 14-19 hours

## Current Issues

| Component | Lines | Problem |
|-----------|-------|---------|
| `NftTableList.js` | 542 | Mixes data fetching, state, filtering, rendering |
| `KindredSpiritsList.js` | 414 | Mixes analysis logic, state, UI rendering |
| `KindredButtonContext.js` | ~150 | Handles both collection selection AND analysis |
| Modal libraries | 2 | Both `react-modal` and `@headlessui/react` installed |

## Tasks

### 1. Split NftTableList.js (~6-8h)

**Current structure:** Single 542-line component handling:
- Collection fetching from Alchemy
- Owner count fetching
- Filtering and sorting logic
- Table rendering
- Selection state

**Target structure:**
```
src/app/
├── hooks/
│   ├── useCollections.js        # Fetch collections for wallet
│   ├── useOwnerCounts.js        # Fetch owner counts with progress
│   └── useCollectionFilters.js  # Filter/sort logic
├── components/
│   └── NftTableList/
│       ├── index.js             # Main component (orchestration only)
│       ├── CollectionTable.js   # Pure table rendering
│       ├── FilterControls.js    # Filter UI
│       ├── NetworkBadge.js      # Network indicator
│       └── CollectionRow.js     # Single row component
```

#### Hook: useCollections
```javascript
// src/app/hooks/useCollections.js
import { useState, useEffect, useCallback } from 'react';

export function useCollections(address, client) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchCollections = useCallback(async () => {
    if (!address || !client) return;

    setLoading(true);
    setError(null);

    try {
      const result = await client.getCollectionsForOwner(
        address,
        null,
        (current, total) => setProgress({ current, total })
      );
      setCollections(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address, client]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return { collections, loading, error, progress, refetch: fetchCollections };
}
```

#### Hook: useOwnerCounts
```javascript
// src/app/hooks/useOwnerCounts.js
import { useState, useCallback } from 'react';
import { processWithConcurrency } from '../lib/concurrency';

export function useOwnerCounts(client, maxCount = 150000) {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const fetchCounts = useCallback(async (collections) => {
    if (!client || !collections.length) return;

    setLoading(true);
    const total = collections.length;
    let current = 0;

    const results = await processWithConcurrency(collections, 4, async (col) => {
      const count = await client.getOwnersCountForContract(
        col.network,
        col.contract,
        maxCount
      );
      current++;
      setProgress({ current, total });
      return { key: `${col.network}:${col.contract}`, count };
    });

    const countMap = {};
    results.forEach(({ key, count }) => { countMap[key] = count; });
    setCounts(countMap);
    setLoading(false);
  }, [client, maxCount]);

  return { counts, loading, progress, fetchCounts };
}
```

#### Hook: useCollectionFilters
```javascript
// src/app/hooks/useCollectionFilters.js
import { useMemo, useState } from 'react';

export function useCollectionFilters(collections, ownerCounts) {
  const [filters, setFilters] = useState({
    network: 'all',
    hideOver150k: false,
    searchText: '',
    sortBy: 'name',
    sortDir: 'asc',
  });

  const filtered = useMemo(() => {
    let result = [...collections];

    // Network filter
    if (filters.network !== 'all') {
      result = result.filter(c => c.network === filters.network);
    }

    // Hide large collections
    if (filters.hideOver150k) {
      result = result.filter(c => {
        const key = `${c.network}:${c.contract}`;
        return (ownerCounts[key] || 0) <= 150000;
      });
    }

    // Search
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(search) ||
        c.contract?.toLowerCase().includes(search)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (filters.sortBy === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else if (filters.sortBy === 'count') {
        const aCount = ownerCounts[`${a.network}:${a.contract}`] || 0;
        const bCount = ownerCounts[`${b.network}:${b.contract}`] || 0;
        cmp = aCount - bCount;
      }
      return filters.sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [collections, ownerCounts, filters]);

  return { filtered, filters, setFilters };
}
```

---

### 2. Split KindredSpiritsList.js (~4-6h)

**Current structure:** Single 414-line component handling:
- Kindred spirit analysis logic
- Progress tracking
- Results rendering
- Modal display

**Target structure:**
```
src/app/
├── hooks/
│   └── useKindredAnalysis.js    # Analysis logic + progress
├── components/
│   └── KindredSpiritsList/
│       ├── index.js             # Main component
│       ├── AnalysisProgress.js  # Progress bar + status
│       ├── ResultsTable.js      # Results table
│       ├── SpiritRow.js         # Single result row
│       └── SpiritModal.js       # Detail modal
```

#### Hook: useKindredAnalysis
```javascript
// src/app/hooks/useKindredAnalysis.js
import { useState, useCallback } from 'react';
import { processWithConcurrency } from '../lib/concurrency';

export function useKindredAnalysis() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ phase: '', current: 0, total: 0 });
  const [error, setError] = useState(null);

  const analyze = useCallback(async (selectedCollections, walletAddress) => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      // Phase 1: Fetch holders for each collection
      setProgress({ phase: 'Fetching holders', current: 0, total: selectedCollections.length });

      const holderSets = await processWithConcurrency(
        selectedCollections,
        4,
        async (collection, index) => {
          setProgress(p => ({ ...p, current: index + 1 }));
          // Fetch holders...
          return { collection, holders: [] }; // placeholder
        }
      );

      // Phase 2: Count overlaps
      setProgress({ phase: 'Counting overlaps', current: 0, total: 1 });
      const overlapCounts = {};
      // ... counting logic

      // Phase 3: Sort and limit
      const sorted = Object.entries(overlapCounts)
        .filter(([addr]) => addr.toLowerCase() !== walletAddress.toLowerCase())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([address, count]) => ({ address, sharedCount: count }));

      setResults(sorted);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, progress, error, analyze };
}
```

---

### 3. Split KindredButtonContext (~2h)

**Current structure:** Single context managing:
- Selected collections state
- Analysis trigger
- Analysis results
- Modal state

**Target structure:**
```
src/app/components/context/
├── CollectionContext.js    # Selected collections only
├── AnalysisContext.js      # Analysis results + trigger
└── index.js                # Re-exports
```

#### CollectionContext
```javascript
// src/app/components/context/CollectionContext.js
import { createContext, useContext, useState, useMemo } from 'react';

const CollectionContext = createContext(null);

export function CollectionProvider({ children }) {
  const [selectedCollections, setSelectedCollections] = useState([]);

  const value = useMemo(() => ({
    selectedCollections,
    addCollection: (col) => setSelectedCollections(prev => [...prev, col]),
    removeCollection: (col) => setSelectedCollections(prev =>
      prev.filter(c => c.contract !== col.contract || c.network !== col.network)
    ),
    clearCollections: () => setSelectedCollections([]),
    isSelected: (col) => selectedCollections.some(
      c => c.contract === col.contract && c.network === col.network
    ),
  }), [selectedCollections]);

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export const useCollectionContext = () => useContext(CollectionContext);
```

#### AnalysisContext
```javascript
// src/app/components/context/AnalysisContext.js
import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useCollectionContext } from './CollectionContext';

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const { selectedCollections } = useCollectionContext();
  const [results, setResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const startAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    // ... analysis logic or API call
    setIsAnalyzing(false);
  }, [selectedCollections]);

  const value = useMemo(() => ({
    results,
    isAnalyzing,
    startAnalysis,
    clearResults: () => setResults([]),
  }), [results, isAnalyzing, startAnalysis]);

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

export const useAnalysisContext = () => useContext(AnalysisContext);
```

---

### 4. Standardize Modal Library (~2-3h)

**Current state:** Both `react-modal` and `@headlessui/react` are installed.

**Decision:** Use `@headlessui/react` - it's more modern, accessible by default, and works better with Tailwind.

**Steps:**
1. Identify all modal usages:
   - Search for `react-modal` imports
   - Search for `Modal` component usage
2. Create wrapper component using Headless UI:
   ```javascript
   // src/app/components/ui/Modal.js
   import { Dialog, Transition } from '@headlessui/react';
   import { Fragment } from 'react';

   export function Modal({ isOpen, onClose, title, children }) {
     return (
       <Transition appear show={isOpen} as={Fragment}>
         <Dialog as="div" className="relative z-50" onClose={onClose}>
           <Transition.Child
             as={Fragment}
             enter="ease-out duration-300"
             enterFrom="opacity-0"
             enterTo="opacity-100"
             leave="ease-in duration-200"
             leaveFrom="opacity-100"
             leaveTo="opacity-0"
           >
             <div className="fixed inset-0 bg-black/25" />
           </Transition.Child>

           <div className="fixed inset-0 overflow-y-auto">
             <div className="flex min-h-full items-center justify-center p-4">
               <Transition.Child
                 as={Fragment}
                 enter="ease-out duration-300"
                 enterFrom="opacity-0 scale-95"
                 enterTo="opacity-100 scale-100"
                 leave="ease-in duration-200"
                 leaveFrom="opacity-100 scale-100"
                 leaveTo="opacity-0 scale-95"
               >
                 <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                   {title && (
                     <Dialog.Title className="text-lg font-medium leading-6 text-gray-900">
                       {title}
                     </Dialog.Title>
                   )}
                   {children}
                 </Dialog.Panel>
               </Transition.Child>
             </div>
           </div>
         </Dialog>
       </Transition>
     );
   }
   ```
3. Migrate all modal usages to new component
4. Remove `react-modal` from `package.json`
5. Run `npm install` to clean up

---

## Checklist

### Phase 1: Extract Hooks (6-8h)
- [ ] Create `src/app/hooks/useCollections.js`
- [ ] Create `src/app/hooks/useOwnerCounts.js`
- [ ] Create `src/app/hooks/useCollectionFilters.js`
- [ ] Create `src/app/hooks/useKindredAnalysis.js`
- [ ] Test hooks in isolation

### Phase 2: Split NftTableList (3-4h)
- [ ] Create `NftTableList/` folder structure
- [ ] Extract `CollectionTable.js`
- [ ] Extract `FilterControls.js`
- [ ] Extract `CollectionRow.js`
- [ ] Refactor main `index.js` to use hooks + sub-components
- [ ] Verify functionality

### Phase 3: Split KindredSpiritsList (2-3h)
- [ ] Create `KindredSpiritsList/` folder structure
- [ ] Extract `AnalysisProgress.js`
- [ ] Extract `ResultsTable.js`
- [ ] Extract `SpiritModal.js`
- [ ] Refactor main `index.js`
- [ ] Verify functionality

### Phase 4: Split Context (2h)
- [ ] Create `CollectionContext.js`
- [ ] Create `AnalysisContext.js`
- [ ] Update `providers.js` to use both contexts
- [ ] Update all context consumers
- [ ] Verify functionality

### Phase 5: Modal Consolidation (2-3h)
- [ ] Create `src/app/components/ui/Modal.js`
- [ ] Find all `react-modal` usages
- [ ] Migrate to Headless UI Modal
- [ ] Remove `react-modal` dependency
- [ ] Test all modal interactions

## Success Criteria

- No component exceeds 200 lines
- All business logic lives in hooks
- Components are pure rendering functions
- Only one modal library in `package.json`
- All existing functionality preserved
- Build passes
